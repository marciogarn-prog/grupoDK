/**
 * Portal DK — Cadastro de Patrimônio (CRLV-e digital).
 * Anexo de PDFs (vários de uma vez) → IA extrai campos → relatório PDF/Excel (administrador).
 */
(function portalPatrimonio() {
  const STORAGE_KEY = "dk_patrimonio_crlv_v1";
  const EXCLUSOES_KEY = "dk_patrimonio_fotos_excluidas_v1";
  const PENDING_FOTO_KEY = "dk_patrimonio_foto_pendente_v1";
  const PATRIMONIO_SCAN_VERSAO = 6;
  const PATRIMONIO_PDF_RENDER_SCALE = 3.35;
  const PATRIMONIO_PDF_JPEG_QUALITY = 0.96;
  /** Miniatura na lista (localStorage) — só preview. */
  const PATRIMONIO_IMAGEM_FILA_MAX_B64 = 28000;
  /** Imagem completa na fila (IndexedDB) — IA e visualização. */
  const PATRIMONIO_IDB_IMAGEM_MAX_B64 = 1600000;
  /** Imagem do documento cadastrado (IndexedDB). */
  const PATRIMONIO_IDB_DOC_IMAGEM_MAX_B64 = 1600000;
  /** PDF original no IndexedDB (qualidade nativa). */
  const PATRIMONIO_IDB_PDF_MAX_B64 = 4500000;
  /** Envio à OpenAI Vision (alta, sem esmagar). */
  const PATRIMONIO_IA_ENVIO_MAX_B64 = 950000;
  const PATRIMONIO_IA_ENVIO_MAX_PX = 2600;
  const PATRIMONIO_DOC_IMAGEM_MAX_PX = 2800;
  const MAX_FOTOS_EXCLUIDAS = 400;

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

  const MSG_NITIDEZ = "PDF sem nitidez suficiente para ser processado.";
  const MSG_IA_FALHOU = "Não foi possível ler o CRLV. Confira o PDF ou envie outro ficheiro.";
  const MAX_PDF_BYTES = 12 * 1024 * 1024;
  const PDF_STORAGE_B64_MAX = 420000;
  const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const PATRIMONIO_MAX_LOTE = 200;
  const PATRIMONIO_MAX_ARQUIVOS = 250;
  /** Campos mínimos — placa, RENAVAM e chassi; resto preenchido com defaults/nome do ficheiro. */
  const CAMPOS_CRITICOS = ["codigoRenavam", "placa", "chassi"];

  const panel = document.getElementById("panel-patrimonio-locadora");
  if (!panel) return;

  const msgEl = document.getElementById("patrimonioMsg");
  const listaEl = document.getElementById("patrimonioLista");
  const fotosListaEl = document.getElementById("patrimonioFotosLista");
  const fotosResumoEl = document.getElementById("patrimonioFotosResumo");
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
  const fotoCapturaViewer = document.getElementById("patrimonioFotoCapturaViewer");
  const fotoCapturaViewerImg = document.getElementById("patrimonioFotoCapturaViewerImg");
  const fotoCapturaTagEl = document.getElementById("patrimonioFotoCapturaTag");
  const fotoCapturaStatusEl = document.getElementById("patrimonioFotoCapturaStatus");
  const pdfInput = document.getElementById("patrimonioPdfInput");
  const pdfDropzone = document.getElementById("patrimonioPdfDropzone");

  let cameraStream = null;
  let previewDataUrl = "";
  let previewDataUrlRaw = "";
  let processando = false;
  let previewSalvando = false;
  let iaPatrimonioRodando = false;
  const filaIaPatrimonio = [];
  /** Fallback se IndexedDB falhar (1–2 itens). Lote grande usa IDB. */
  const patrimonioImagensFila = new Map();
  const PATRIMONIO_IA_INTERVALO_MS = 1100;
  const PATRIMONIO_IA_TIMEOUT_MS = 420000;
  const PATRIMONIO_IA_MAX_TENTATIVAS = 5;
  let patrimonioWakeLock = null;
  let patrimonioLoteRecebidos = 0;
  let patrimonioLoteTotal = 0;
  let patrimonioLoteExcluidos = 0;
  let patrimonioLoteCadastrados = 0;
  let patrimonioSyncCloudPausado = 0;
  let patrimonioConvertendoPdfs = false;
  let patrimonioModalHistorico = false;
  let patrimonioHistorySuppress = false;
  let patrimonioFlashLigado = true;
  let patrimonioCameraDeviceId = "";

  function patrimonioLabelEhFrontal(label) {
    const L = String(label || "").toLowerCase();
    return /front|user|selfie|facial|face|frontal/.test(L);
  }

  function patrimonioLabelEhTraseira(label) {
    const L = String(label || "").toLowerCase();
    if (patrimonioLabelEhFrontal(L)) return false;
    if (/back|rear|traseir|environment|trás|facing back/.test(L)) return true;
    return !patrimonioLabelEhFrontal(L);
  }

  function patrimonioLabelPrioridadeCameraTraseira(label) {
    const L = String(label || "").toLowerCase();
    let s = 0;
    if (/back|rear|traseir|environment|facing back/.test(L)) s += 30;
    if (/camera2 0|camera 0/.test(L)) s += 12;
    if (/main|standard/.test(L)) s += 18;
    if (/wide/.test(L) && !/ultra/.test(L)) s += 8;
    if (/ultra|macro|depth|tele|zoom|dual|aux/.test(L)) s -= 25;
    if (patrimonioLabelEhFrontal(L)) s -= 100;
    return s;
  }

  function patrimonioTrackEhTraseira(track) {
    if (!track) return false;
    const settings = track.getSettings?.() || {};
    if (settings.facingMode === "environment") return true;
    if (settings.facingMode === "user") return false;
    return patrimonioLabelEhTraseira(track.label || "");
  }

  function patrimonioTrackTemTorch(track) {
    const caps = patrimonioTrackCaps(track);
    return "torch" in caps && caps.torch !== false;
  }

  async function patrimonioGarantirPermissaoCamera() {
    let tmp = null;
    try {
      tmp = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      return false;
    }
    tmp.getTracks().forEach((t) => t.stop());
    return true;
  }

  /** Escolhe câmera TRASEIRA principal com lanterna (Galaxy S24: evita ultra-wide/frontal). */
  async function patrimonioDetectarCameraTraseiraComLanterna() {
    if (!navigator.mediaDevices?.getUserMedia) return "";
    await patrimonioGarantirPermissaoCamera();
    let devices = [];
    try {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    } catch {
      return "";
    }
    if (!devices.length) return "";

    let candidatos = devices.filter((d) => patrimonioLabelEhTraseira(d.label));
    if (!candidatos.length) candidatos = devices.filter((d) => !patrimonioLabelEhFrontal(d.label));
    if (!candidatos.length) candidatos = devices.slice();

    candidatos.sort(
      (a, b) => patrimonioLabelPrioridadeCameraTraseira(b.label) - patrimonioLabelPrioridadeCameraTraseira(a.label)
    );

    let melhorId = "";
    let melhorScore = -999;

    for (const dev of candidatos.slice(0, 6)) {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: dev.deviceId } },
          audio: false,
        });
        const track = stream.getVideoTracks()[0];
        if (!track) continue;
        let score = patrimonioLabelPrioridadeCameraTraseira(dev.label || track.label || "");
        if (patrimonioTrackEhTraseira(track)) score += 40;
        if (patrimonioTrackTemTorch(track)) score += 80;
        if (score > melhorScore) {
          melhorScore = score;
          melhorId = dev.deviceId;
        }
      } catch {
        /* tentar próxima lente */
      } finally {
        stream?.getTracks?.().forEach((t) => t.stop());
      }
    }

    return melhorId || candidatos[0]?.deviceId || "";
  }

  function patrimonioVideoConstraintsBase(extra) {
    const base = {
      width: { ideal: patrimonioEhAndroidSamsung() ? 1920 : 1280, max: 3840 },
      height: { ideal: patrimonioEhAndroidSamsung() ? 1080 : 720, max: 2160 },
      ...(extra || {}),
    };
    if (patrimonioCameraDeviceId) {
      return { deviceId: { exact: patrimonioCameraDeviceId }, ...base };
    }
    return { facingMode: { ideal: "environment" }, ...base };
  }

  function patrimonioOverlayAberto() {
    return (
      (cameraOverlay && !cameraOverlay.classList.contains("hidden")) ||
      (previewOverlay && !previewOverlay.classList.contains("hidden")) ||
      (imagemViewer && !imagemViewer.classList.contains("hidden")) ||
      (fotoCapturaViewer && !fotoCapturaViewer.classList.contains("hidden"))
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
      return;
    }
    if (fotoCapturaViewer && !fotoCapturaViewer.classList.contains("hidden")) {
      fecharViewerFotoCaptura(false);
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

  function newFotoId() {
    return `fot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatTagPatrimonioFoto(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "00000000-000000-000";
    const pad = (n) => String(n).padStart(2, "0");
    const pad3 = (n) => String(n).padStart(3, "0");
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}-${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}-${pad3(dt.getMilliseconds())}`;
  }

  function formatTagPatrimonioFotoLegivel(tag) {
    const t = String(tag || "");
    const m = t.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d{1,3}))?$/);
    if (!m) return t;
    const ms = m[7] ? `.${String(m[7]).padStart(3, "0")}` : "";
    return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}${ms}`;
  }

  function fotoCapturaMs(f) {
    const t = Date.parse(String(f?.registradoEm || f?.atualizadoEm || ""));
    return Number.isFinite(t) ? t : 0;
  }

  function sanitizeFotoCaptura(f) {
    if (!f || typeof f !== "object") return null;
    const id = String(f.id || "").trim();
    const tag = String(f.tag || "").trim();
    if (!id || !tag) return null;
    const imagem = String(f.imagem || "").trim();
    const temImagem = imagem.startsWith("data:image/");
    const st = String(f.statusIa || "").toLowerCase();
    const emFila = st === "fila" || st === "pendente";
    if (!temImagem && !f.imagemIndisponivel && !emFila) return null;
    const pdfOriginal = String(f.pdfOriginal || "").trim();
    const pdfOk = pdfOriginal.startsWith("data:application/pdf");
    return {
      id,
      tag,
      tipo: String(f.tipo || (pdfOk ? "pdf" : "foto")),
      nomeArquivo: String(f.nomeArquivo || "").trim() || undefined,
      registradoEm: String(f.registradoEm || new Date().toISOString()),
      imagem: temImagem ? imagem : "",
      imagemOriginal: String(f.imagemOriginal || "").trim() || undefined,
      pdfOriginal: pdfOk ? pdfOriginal : undefined,
      imagemIndisponivel: !temImagem,
      statusIa: String(f.statusIa || "pendente"),
      docId: String(f.docId || "").trim(),
      placa: String(f.placa || "").trim(),
      msgIa: String(f.msgIa || "").trim(),
      tentativasIa: Math.max(0, Math.min(PATRIMONIO_IA_MAX_TENTATIVAS, Number(f.tentativasIa) || 0)),
      atualizadoEm: String(f.atualizadoEm || f.registradoEm || ""),
    };
  }

  function sanitizeFotosCapturas(list) {
    const map = new Map();
    for (const f of list || []) {
      const s = sanitizeFotoCaptura(f);
      if (!s) continue;
      const prev = map.get(s.id);
      if (!prev || fotoCapturaMs(s) >= fotoCapturaMs(prev)) map.set(s.id, s);
    }
    return [...map.values()].sort((a, b) => fotoCapturaMs(b) - fotoCapturaMs(a));
  }

  function mergeFotosCapturasExcluidas(...listas) {
    const map = new Map();
    for (const lista of listas) {
      for (const item of lista || []) {
        const id = String(item?.id || item || "").trim();
        if (!id) continue;
        const excluidoEm = String(item?.excluidoEm || new Date().toISOString());
        const prev = map.get(id);
        if (!prev || Date.parse(excluidoEm) >= Date.parse(prev.excluidoEm || 0)) {
          map.set(id, { id, excluidoEm });
        }
      }
    }
    return [...map.values()].slice(-MAX_FOTOS_EXCLUIDAS);
  }

  function exclusaoFotoCapturaEntry(id, tag) {
    const idStr = String(id || "").trim();
    if (!idStr) return null;
    const tagStr = String(tag || "").trim();
    return {
      id: idStr,
      tag: tagStr || undefined,
      excluidoEm: new Date().toISOString(),
    };
  }

  function aplicarExclusoesFotosCapturas(fotos, exclusoes) {
    const ids = new Set();
    const tags = new Set();
    for (const e of exclusoes || []) {
      const id = String(e?.id || "").trim();
      if (id) ids.add(id);
      const tag = String(e?.tag || "").trim();
      if (tag) tags.add(tag);
    }
    return (fotos || []).filter((f) => {
      if (!f?.id) return false;
      if (ids.has(f.id)) return false;
      const tag = String(f.tag || "").trim();
      if (tag && tags.has(tag)) return false;
      return true;
    });
  }

  function findFotoCapturaRawById(id) {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const list = Array.isArray(raw.fotosCapturas) ? raw.fotosCapturas : [];
      return list.find((f) => f && f.id === id) || null;
    } catch {
      return null;
    }
  }

  function getFotosCapturas(store) {
    const s = store || loadStore();
    return aplicarExclusoesFotosCapturas(
      sanitizeFotosCapturas(s.fotosCapturas),
      s.fotosCapturasExcluidas
    );
  }

  function getFotoCapturaById(id) {
    return getFotosCapturas().find((f) => f.id === id) || null;
  }

  function labelStatusArquivoCaptura(f) {
    const st = String(f?.statusIa || "").toLowerCase();
    if (st === "ok") {
      return f.placa ? `IA OK · ${f.placa}` : "IA OK · cadastrado";
    }
    if (st === "falhou") return f.msgIa ? `Reprovado · ${f.msgIa}` : "Reprovado pela IA";
    if (st === "processando") return "IA a processar…";
    if (st === "fila") {
      const t = tentativasIaFoto(f);
      return t > 0
        ? `Na fila · tentativa ${t + 1}/${PATRIMONIO_IA_MAX_TENTATIVAS}`
        : "Na fila da IA…";
    }
    return "Aguardando IA";
  }

  function classeStatusFotoCaptura(f) {
    const st = String(f?.statusIa || "").toLowerCase();
    if (st === "ok") return "patrimonio-foto-status patrimonio-foto-status--ok";
    if (st === "falhou") return "patrimonio-foto-status patrimonio-foto-status--falhou";
    if (st === "processando") return "patrimonio-foto-status patrimonio-foto-status--proc";
    return "patrimonio-foto-status";
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

  /** Mesma placa Mercosul = mesmo veículo (regra de substituição ao anexar novo PDF). */
  function documentoMesmaPlaca(a, b) {
    const pa = normPlaca(resolverPlacaMercosul(a?.placaNorm || a?.placa));
    const pb = normPlaca(resolverPlacaMercosul(b?.placaNorm || b?.placa));
    return Boolean(pa && pb && pa === pb);
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
      const exclusoes = persistirExclusoesPatrimonio(
        todasExclusoesPatrimonio(raw.fotosCapturasExcluidas)
      );
      const fotosCapturas = aplicarExclusoesFotosCapturas(
        sanitizeFotosCapturas(raw.fotosCapturas),
        exclusoes
      );
      return {
        documentos: deduplicarDocumentos(documentos),
        fotosCapturas,
        fotosCapturasExcluidas: exclusoes,
      };
    } catch {
      return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
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

  function stripDocumentosParaLocalStorage(documentos) {
    return (documentos || []).map((d) => {
      const ir = String(d.imagemRecortada || "");
      const irLen = ir.startsWith("data:") ? parseDataUrl(ir).base64.length : 0;
      const pdf = String(d.imagemPdfRecortada || "");
      const pdfLen = pdf.startsWith("data:") ? parseDataUrl(pdf).base64.length : 0;
      if (!d.imagemDocIdb && irLen <= 5000 && pdfLen <= 5000) return d;
      return {
        ...d,
        imagemRecortada: irLen <= 5000 ? ir : "",
        imagemPdfRecortada: pdfLen <= 5000 ? pdf || undefined : undefined,
        imagemDocIdb: Boolean(d.imagemDocIdb || irLen > 5000),
        pdfDocIdb: Boolean(d.pdfDocIdb || pdfLen > 5000),
      };
    });
  }

  function patrimonioPausarSyncCloud() {
    patrimonioSyncCloudPausado++;
  }

  function patrimonioRetomarSyncCloud() {
    patrimonioSyncCloudPausado = Math.max(0, patrimonioSyncCloudPausado - 1);
    if (
      patrimonioSyncCloudPausado === 0 &&
      !patrimonioConvertendoPdfs &&
      !iaPatrimonioRodando &&
      typeof portalPushCloudSnapshotAfterPersist === "function"
    ) {
      portalPushCloudSnapshotAfterPersist();
    }
  }

  function saveStore(store) {
    let prev;
    try {
      prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      prev = {};
    }
    const prevDocs = Array.isArray(prev.documentos) ? prev.documentos : [];
    const documentos = stripDocumentosParaLocalStorage(
      deduplicarDocumentos(store?.documentos ?? prevDocs)
    );
    const exclusoes = persistirExclusoesPatrimonio(
      todasExclusoesPatrimonio(store?.fotosCapturasExcluidas, prev.fotosCapturasExcluidas)
    );
    let fotosCapturas = sanitizeFotosCapturas(store?.fotosCapturas ?? prev.fotosCapturas).slice(
      0,
      PATRIMONIO_MAX_ARQUIVOS
    );
    fotosCapturas = aplicarExclusoesFotosCapturas(fotosCapturas, exclusoes);

    const payload = { documentos, fotosCapturas, fotosCapturasExcluidas: exclusoes };
    const gravar = (docs, lista) => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...payload, documentos: docs, fotosCapturas: lista })
      );
    };
    try {
      gravar(documentos, fotosCapturas);
    } catch {
      const aliviada = fotosCapturas.map((f) => ({
        ...f,
        imagem: "",
        pdfOriginal: undefined,
        imagemIndisponivel: true,
      }));
      try {
        gravar(documentos, aliviada);
      } catch {
        const docsLeves = documentos.map((d) => ({
          ...d,
          imagemRecortada: "",
          imagemPdfRecortada: undefined,
          imagemDocIdb: true,
        }));
        gravar(docsLeves, aliviada);
      }
    }
    if (
      patrimonioSyncCloudPausado === 0 &&
      !patrimonioConvertendoPdfs &&
      !iaPatrimonioRodando &&
      typeof portalPushCloudSnapshotAfterPersist === "function"
    ) {
      portalPushCloudSnapshotAfterPersist();
    }
  }

  /** Arquivo/PDF mais recente da mesma placa substitui tentativas antigas na lista de enviados. */
  function removerFotosAntigasMesmaPlaca(placa, manterFotoId) {
    const p = normPlaca(placa);
    if (!p || !manterFotoId) return;
    const store = loadStore();
    let exclusoes = store.fotosCapturasExcluidas || [];
    const agora = new Date().toISOString();
    const fotos = [];
    for (const f of store.fotosCapturas) {
      if (f.id === manterFotoId) {
        fotos.push(f);
        continue;
      }
      const fp = normPlaca(f.placa);
      if (fp && fp === p) {
        exclusoes = mergeFotosCapturasExcluidas(
          exclusoes,
          exclusaoFotoCapturaEntry(f.id, f.tag) || [{ id: f.id, excluidoEm: agora }]
        );
      } else {
        fotos.push(f);
      }
    }
    saveStore({
      documentos: store.documentos,
      fotosCapturas: fotos,
      fotosCapturasExcluidas: exclusoes,
    });
  }

  function atualizarFotoCaptura(id, patch) {
    const store = loadStore();
    const idx = store.fotosCapturas.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    store.fotosCapturas[idx] = sanitizeFotoCaptura({
      ...store.fotosCapturas[idx],
      ...patch,
      atualizadoEm: new Date().toISOString(),
    });
    saveStore(store);
    return store.fotosCapturas[idx];
  }

  async function registrarFotoCaptura(dataUrlRaw, dataUrlTratada) {
    const agora = new Date();
    const imagemTratada = dataUrlTratada || dataUrlRaw;
    const mob = patrimonioEhAndroid() || /iPhone|iPad/i.test(navigator.userAgent);
    const imagem = await comprimirImagemLimite(
      imagemTratada,
      mob ? 1200 : 1500,
      mob ? 260000 : 300000,
      mob ? 0.82 : 0.86
    );
    let imagemOriginal;
    if (dataUrlRaw && dataUrlRaw !== imagemTratada) {
      imagemOriginal = await comprimirImagemLimite(
        dataUrlRaw,
        mob ? 1100 : 1300,
        mob ? 220000 : 260000,
        0.84
      );
    }
    const foto = sanitizeFotoCaptura({
      id: newFotoId(),
      tag: formatTagPatrimonioFoto(agora),
      registradoEm: agora.toISOString(),
      imagem,
      imagemOriginal,
      statusIa: "processando",
      docId: "",
      placa: "",
      msgIa: "",
      atualizadoEm: agora.toISOString(),
    });
    if (!foto) return null;
    const store = loadStore();
    store.fotosCapturas = [foto, ...store.fotosCapturas].slice(0, PATRIMONIO_MAX_ARQUIVOS);
    saveStore(store);
    return foto;
  }

  function atualizarProgressoLotePatrimonio(recebidos, total, extra) {
    const wrap = document.getElementById("patrimonioLoteProgress");
    const fill = document.getElementById("patrimonioLoteProgressFill");
    const txt = document.getElementById("patrimonioLoteProgressText");
    if (!wrap || !fill || !txt) return;
    const t = Math.max(1, total || 1);
    const pct = Math.min(100, Math.round((recebidos / t) * 100));
    wrap.classList.toggle("hidden", total <= 0);
    fill.style.width = `${pct}%`;
    txt.textContent = extra || `A preparar ${recebidos}/${total} PDF(s) para a fila da IA…`;
  }

  async function patrimonioAtivarWakeLock() {
    try {
      if (navigator.wakeLock && !patrimonioWakeLock) {
        patrimonioWakeLock = await navigator.wakeLock.request("screen");
      }
    } catch {
      /* ignore */
    }
  }

  function patrimonioLibertarWakeLock() {
    try {
      patrimonioWakeLock?.release?.();
    } catch {
      /* ignore */
    }
    patrimonioWakeLock = null;
  }

  async function patrimonioSalvarImagemFila(id, imagem, meta) {
    const imagemAlta = await comprimirImagemLimite(
      imagem,
      PATRIMONIO_DOC_IMAGEM_MAX_PX,
      PATRIMONIO_IDB_IMAGEM_MAX_B64,
      PATRIMONIO_PDF_JPEG_QUALITY
    );
    const payload = {
      imagem: imagemAlta,
      nomeArquivo: String(meta?.nomeArquivo || "").slice(0, 120),
    };
    const pdf = String(meta?.pdfOriginal || "");
    if (pdf.startsWith("data:application/pdf")) {
      const pdfLen = parseDataUrl(pdf).base64.length;
      if (pdfLen > 0 && pdfLen <= PATRIMONIO_IDB_PDF_MAX_B64) {
        payload.pdfOriginal = pdf;
      }
    }
    if (typeof window.__DK_patrimonioIdbPut === "function") {
      await window.__DK_patrimonioIdbPut(id, payload);
      patrimonioImagensFila.delete(id);
      return imagemAlta;
    }
    patrimonioImagensFila.set(id, { ...payload });
    return imagemAlta;
  }

  async function patrimonioLerPdfFila(id) {
    if (typeof window.__DK_patrimonioIdbGet === "function") {
      try {
        const row = await window.__DK_patrimonioIdbGet(id);
        const pdf = String(row?.pdfOriginal || "");
        if (pdf.startsWith("data:application/pdf")) return pdf;
      } catch {
        /* ignore */
      }
    }
    return patrimonioImagensFila.get(id)?.pdfOriginal || "";
  }

  async function patrimonioLerImagemFila(id) {
    if (typeof window.__DK_patrimonioIdbGet === "function") {
      try {
        const row = await window.__DK_patrimonioIdbGet(id);
        if (row?.imagem?.startsWith("data:image/")) return row.imagem;
      } catch {
        /* fallback memória */
      }
    }
    return patrimonioImagensFila.get(id)?.imagem || "";
  }

  async function patrimonioApagarImagemFila(id) {
    patrimonioImagensFila.delete(id);
    if (typeof window.__DK_patrimonioIdbDelete === "function") {
      try {
        await window.__DK_patrimonioIdbDelete(id);
      } catch {
        /* ignore */
      }
    }
  }

  async function prepararImagemDocumentoArmazenar(dataUrl) {
    if (!String(dataUrl || "").startsWith("data:image/")) return "";
    return comprimirImagemLimite(
      dataUrl,
      PATRIMONIO_DOC_IMAGEM_MAX_PX,
      PATRIMONIO_IDB_DOC_IMAGEM_MAX_B64,
      PATRIMONIO_PDF_JPEG_QUALITY
    );
  }

  async function patrimonioSalvarImagensDoc(docId, imagens) {
    if (!docId || typeof window.__DK_patrimonioIdbPut !== "function") return false;
    try {
      const ir = String(imagens?.imagemRecortada || "");
      const pdf = String(imagens?.imagemPdfRecortada || "");
      const payload = { tipo: "doc", imagemRecortada: ir, imagemPdfRecortada: "" };
      if (pdf.startsWith("data:application/pdf")) {
        const pdfLen = parseDataUrl(pdf).base64.length;
        if (pdfLen > 0 && pdfLen <= PATRIMONIO_IDB_PDF_MAX_B64) {
          payload.imagemPdfRecortada = pdf;
        }
      }
      await window.__DK_patrimonioIdbPut(docId, payload);
      return true;
    } catch {
      return false;
    }
  }

  async function patrimonioLerImagensDoc(docId) {
    if (!docId || typeof window.__DK_patrimonioIdbGet !== "function") return null;
    try {
      const row = await window.__DK_patrimonioIdbGet(docId);
      if (!row) return null;
      const ir = String(row.imagemRecortada || "");
      const pdf = String(row.imagemPdfRecortada || "");
      if (!ir.startsWith("data:image/") && !pdf.startsWith("data:application/pdf")) return null;
      return {
        imagemRecortada: ir.startsWith("data:image/") ? ir : "",
        imagemPdfRecortada: pdf.startsWith("data:application/pdf") ? pdf : "",
      };
    } catch {
      return null;
    }
  }

  async function patrimonioApagarImagensDoc(docId) {
    if (!docId || typeof window.__DK_patrimonioIdbDelete !== "function") return;
    try {
      await window.__DK_patrimonioIdbDelete(docId);
    } catch {
      /* ignore */
    }
  }

  async function patrimonioMigrarImagensDocParaIdb() {
    const store = loadStore();
    let alterou = false;
    for (const d of store.documentos) {
      if (d.imagemDocIdb) continue;
      const ir = String(d.imagemRecortada || "");
      if (!ir.startsWith("data:image/") || parseDataUrl(ir).base64.length < 6000) continue;
      const pdfInline = d.imagemPdfRecortada || "";
      await patrimonioSalvarImagensDoc(d.id, {
        imagemRecortada: ir,
        imagemPdfRecortada: pdfInline,
      });
      d.imagemRecortada = "";
      d.imagemPdfRecortada = undefined;
      d.imagemDocIdb = true;
      d.pdfDocIdb = Boolean(String(pdfInline).startsWith("data:application/pdf"));
      alterou = true;
    }
    if (alterou) saveStore({ documentos: store.documentos });
  }

  async function patrimonioFilaTemImagem(id) {
    if (patrimonioImagensFila.has(id)) return true;
    if (typeof window.__DK_patrimonioIdbHas === "function") {
      try {
        return await window.__DK_patrimonioIdbHas(id);
      } catch {
        return false;
      }
    }
    const f = getFotoCapturaById(id);
    return Boolean(f?.imagem?.startsWith("data:image/"));
  }

  function repararFotosCapturasPendentes() {
    const store = loadStore();
    const agora = Date.now();
    let alterou = false;
    for (const f of store.fotosCapturas) {
      const st = String(f.statusIa || "").toLowerCase();
      if (st === "fila" || st === "pendente") continue;
      if (st !== "processando") continue;
      const elapsed = agora - fotoCapturaMs(f);
      if (elapsed >= PATRIMONIO_IA_TIMEOUT_MS) {
        void tratarFalhaIaFotoCaptura(f.id, "Tempo esgotado na IA.");
        continue;
      }
      if (elapsed > 120000) {
        f.statusIa = "fila";
        f.msgIa = "";
        f.atualizadoEm = new Date().toISOString();
        alterou = true;
      }
    }
    if (alterou) saveStore(store);
  }

  function placaDoNomeArquivo(nome) {
    const m = String(nome || "").match(/CRLVDigital[_-]([A-Za-z0-9]{7})[_-]/i);
    if (!m) return "";
    return resolverPlacaMercosul(m[1]);
  }

  function exercicioDoNomeArquivo(nome) {
    const m = String(nome || "").match(/CRLVDigital[_-][A-Za-z0-9]{7}[_-](\d{4})/i);
    return m ? m[1] : "";
  }

  async function imagensParaFotoCapturaAsync(fotoId, imagensPassadas) {
    const passadas = (imagensPassadas || []).filter(Boolean);
    if (passadas.length) return passadas;
    const idb = await patrimonioLerImagemFila(fotoId);
    if (idb) return [idb];
    const foto = getFotoCapturaById(fotoId);
    if (foto?.imagem?.startsWith("data:image/")) return [foto.imagem];
    return [];
  }

  function imagensParaFotoCaptura(fotoId, imagensPassadas) {
    const passadas = (imagensPassadas || []).filter(Boolean);
    if (passadas.length) return passadas;
    const mem = patrimonioImagensFila.get(fotoId);
    if (mem?.imagem) return [mem.imagem];
    const foto = getFotoCapturaById(fotoId);
    if (foto?.imagem?.startsWith("data:image/")) return [foto.imagem];
    return [];
  }

  function fotoEstaPendenteIa(f) {
    const st = String(f?.statusIa || "").toLowerCase();
    return st === "fila" || st === "processando" || st === "pendente" || st === "falhou";
  }

  function tentativasIaFoto(f) {
    const n = Number(f?.tentativasIa);
    if (Number.isFinite(n) && n > 0) return Math.min(PATRIMONIO_IA_MAX_TENTATIVAS, n);
    const st = String(f?.statusIa || "").toLowerCase();
    return st === "falhou" ? 1 : 0;
  }

  async function excluirFotoCapturaAutomatico(id, motivo) {
    if (!id) return false;
    await patrimonioApagarImagemFila(id);
    if (!excluirFotoCapturaRegistro(id)) return false;
    patrimonioLoteExcluidos++;
    console.warn("[DK patrimônio] arquivo excluído após IA:", id, motivo || "");
    return true;
  }

  async function excluirFotoCapturaAposSucesso(id) {
    if (!id) return false;
    await patrimonioApagarImagemFila(id);
    return excluirFotoCapturaRegistro(id);
  }

  function excluirFotoCapturaRegistro(id) {
    if (!id) return false;
    const store = loadStore();
    const rawFoto = findFotoCapturaRawById(id);
    if (!store.fotosCapturas.some((f) => f.id === id)) return false;
    const tag =
      String(rawFoto?.tag || "").trim() ||
      String(store.fotosCapturas.find((f) => f.id === id)?.tag || "").trim();
    const exclusoes = persistirExclusoesPatrimonio(
      todasExclusoesPatrimonio(
        store.fotosCapturasExcluidas,
        exclusaoFotoCapturaEntry(id, tag) || [{ id, excluidoEm: new Date().toISOString() }]
      )
    );
    saveStore({
      documentos: store.documentos,
      fotosCapturas: aplicarExclusoesFotosCapturas(
        store.fotosCapturas.filter((f) => f.id !== id),
        exclusoes
      ),
      fotosCapturasExcluidas: exclusoes,
    });
    return true;
  }

  function patrimonioLimparArquivosEnviados(storeIn) {
    const store = storeIn || loadStore();
    const documentos = Array.isArray(store.documentos) ? store.documentos : [];
    const placasDoc = new Set();
    for (const d of documentos) {
      const p = normPlaca(d.placa);
      if (p) placasDoc.add(p);
    }

    let exclusoes = store.fotosCapturasExcluidas || [];
    const agora = new Date().toISOString();
    const fotos = sanitizeFotosCapturas(store.fotosCapturas || []);
    const ordenadas = [...fotos].sort((a, b) => fotoCapturaMs(b) - fotoCapturaMs(a));
    const manter = [];
    const nomeVisto = new Set();
    const tagVisto = new Set();

    const marcarExclusao = (f) => {
      exclusoes = mergeFotosCapturasExcluidas(
        exclusoes,
        exclusaoFotoCapturaEntry(f.id, f.tag) || [{ id: f.id, excluidoEm: agora }]
      );
    };

    for (const f of ordenadas) {
      const st = String(f.statusIa || "").toLowerCase();

      if (st === "ok" || st === "falhou" || !fotoEstaPendenteIa(f)) {
        marcarExclusao(f);
        continue;
      }

      const placaHint = placaDoNomeArquivo(f.nomeArquivo);
      const placaEfetiva = normPlaca(f.placa) || placaHint;
      if (placaEfetiva && placasDoc.has(placaEfetiva)) {
        marcarExclusao(f);
        continue;
      }

      const nome = String(f.nomeArquivo || "").trim().toLowerCase();
      if (nome) {
        if (nomeVisto.has(nome)) {
          marcarExclusao(f);
          continue;
        }
        nomeVisto.add(nome);
      }

      if (tagVisto.has(f.tag)) {
        marcarExclusao(f);
        continue;
      }
      tagVisto.add(f.tag);

      manter.push(f);
    }

    return {
      documentos,
      fotosCapturas: manter.sort((a, b) => fotoCapturaMs(b) - fotoCapturaMs(a)),
      fotosCapturasExcluidas: persistirExclusoesPatrimonio(exclusoes),
    };
  }

  async function patrimonioAplicarLimpezaArquivosEnviados() {
    const store = loadStore();
    const idsAntes = new Set((store.fotosCapturas || []).map((f) => f.id));
    const limpo = patrimonioLimparArquivosEnviados(store);
    const idsDepois = new Set(limpo.fotosCapturas.map((f) => f.id));
    let removidos = 0;
    for (const id of idsAntes) {
      if (!idsDepois.has(id)) {
        removidos++;
        await patrimonioApagarImagemFila(id);
      }
    }
    if (removidos > 0 || limpo.fotosCapturas.length !== store.fotosCapturas.length) {
      saveStore(limpo);
    }
    return removidos;
  }

  async function tratarFalhaIaFotoCaptura(fotoId, msg) {
    const foto = getFotoCapturaById(fotoId);
    if (!foto) return "excluido";
    const tent = tentativasIaFoto(foto) + 1;
    const detalhe = String(msg || MSG_IA_FALHOU).slice(0, 160);
    if (tent >= PATRIMONIO_IA_MAX_TENTATIVAS) {
      await excluirFotoCapturaAutomatico(
        fotoId,
        `${detalhe} (esgotou ${PATRIMONIO_IA_MAX_TENTATIVAS} tentativas)`
      );
      renderFotosLista();
      return "excluido";
    }
    atualizarFotoCaptura(fotoId, {
      statusIa: "fila",
      tentativasIa: tent,
      msgIa: `Tentativa ${tent}/${PATRIMONIO_IA_MAX_TENTATIVAS} — ${detalhe}`,
    });
    enfileirarIaPatrimonio(fotoId, []);
    renderFotosLista();
    return "reenfileirado";
  }

  function contagemFilaPatrimonio() {
    const fotos = getFotosCapturas();
    let fila = 0;
    let processando = 0;
    let ok = 0;
    let falhou = 0;
    for (const f of fotos) {
      const st = String(f.statusIa || "").toLowerCase();
      if (st === "ok") ok++;
      else if (st === "falhou") falhou++;
      else if (st === "processando") processando++;
      else fila++;
    }
    return { fila, processando, ok, falhou, total: fotos.length };
  }

  async function reiniciarFilaPatrimonioAposAbrir() {
    const fotos = getFotosCapturas().filter((f) => fotoEstaPendenteIa(f));
    if (!fotos.length) return;
    patrimonioPausarSyncCloud();
    for (const f of fotos) {
      if (String(f.statusIa || "").toLowerCase() === "processando") {
        atualizarFotoCaptura(f.id, { statusIa: "fila", msgIa: f.msgIa || "" });
      }
      if (await patrimonioFilaTemImagem(f.id)) {
        enfileirarIaPatrimonio(f.id, []);
      } else if (tentativasIaFoto(f) >= PATRIMONIO_IA_MAX_TENTATIVAS) {
        await excluirFotoCapturaAutomatico(f.id, "Sem imagem guardada.");
      }
    }
    void finalizarLotePatrimonioAposUpload();
  }

  async function patrimonioDrenarLoteSemPendentes() {
    let rodadas = 0;
    while (rodadas < 12) {
      rodadas++;
      const pendentes = getFotosCapturas().filter((f) => fotoEstaPendenteIa(f));
      if (!pendentes.length && !filaIaPatrimonio.length) break;

      for (const f of pendentes) {
        const tent = tentativasIaFoto(f);
        const temImg = await patrimonioFilaTemImagem(f.id);
        if (!temImg || tent >= PATRIMONIO_IA_MAX_TENTATIVAS) {
          await excluirFotoCapturaAutomatico(
            f.id,
            temImg
              ? `Esgotou ${PATRIMONIO_IA_MAX_TENTATIVAS} tentativas de IA.`
              : "Imagem indisponível."
          );
          continue;
        }
        if (filaIaPatrimonio.some((j) => j.fotoId === f.id)) continue;
        atualizarFotoCaptura(f.id, {
          statusIa: "fila",
          tentativasIa: tent,
          msgIa: f.msgIa || `Retomando (${tent}/${PATRIMONIO_IA_MAX_TENTATIVAS})…`,
        });
        enfileirarIaPatrimonio(f.id, []);
      }

      if (filaIaPatrimonio.length) {
        await processarFilaIaPatrimonioInterno();
      } else if (!getFotosCapturas().some((f) => fotoEstaPendenteIa(f))) {
        break;
      }
    }

    const sobraram = getFotosCapturas().filter((f) => fotoEstaPendenteIa(f));
    for (const f of sobraram) {
      await excluirFotoCapturaAutomatico(f.id, "Não processado — removido para não ficar pendente.");
    }
  }

  function enfileirarIaPatrimonio(fotoId, imagens) {
    if (!fotoId) return;
    if (filaIaPatrimonio.some((j) => j.fotoId === fotoId)) return;
    filaIaPatrimonio.push({ fotoId, imagens: (imagens || []).filter(Boolean) });
    void processarFilaIaPatrimonioInterno();
  }

  async function aguardarIaPatrimonioParar() {
    while (iaPatrimonioRodando) {
      await new Promise((r) => window.setTimeout(r, 200));
    }
  }

  async function finalizarLotePatrimonioAposUpload() {
    await aguardarIaPatrimonioParar();
    await processarFilaIaPatrimonio();
  }

  async function processarFilaIaPatrimonio() {
    if (iaPatrimonioRodando) return;
    await processarFilaIaPatrimonioInterno();
    await patrimonioDrenarLoteSemPendentes();
    const c = contagemFilaPatrimonio();
    const excl = patrimonioLoteExcluidos;
    const cad = patrimonioLoteCadastrados;
    const pendentes = getFotosCapturasEmProcessamento().length;
    if (cad > 0 || excl > 0 || pendentes > 0 || c.total > 0) {
      const partes = [];
      if (cad > 0) partes.push(`${cad} cadastrado(s) neste lote`);
      if (excl > 0) partes.push(`${excl} excluído(s) após ${PATRIMONIO_IA_MAX_TENTATIVAS} tentativas`);
      setMsg(
        pendentes
          ? `A processar… ${partes.join(" · ") || "em curso"} · ${pendentes} restante(s).`
          : `Lote concluído${partes.length ? `: ${partes.join(" · ")}` : ""}.`,
        excl > 0,
        excl === 0 && !pendentes
      );
    }
    renderFotosLista();
    renderLista();
    patrimonioRetomarSyncCloud();
    await patrimonioAplicarLimpezaArquivosEnviados();
    renderFotosLista();
  }

  async function processarFilaIaPatrimonioInterno() {
    if (iaPatrimonioRodando) return;
    iaPatrimonioRodando = true;
    await patrimonioAtivarWakeLock();
    let n = 0;
    const totalFilaInicial = Math.max(filaIaPatrimonio.length, 1);
    while (filaIaPatrimonio.length) {
      const job = filaIaPatrimonio.shift();
      if (job?.fotoId) {
        n++;
        const c = contagemFilaPatrimonio();
        const restantes = filaIaPatrimonio.length;
        setMsg(
          `IA · até ${PATRIMONIO_IA_MAX_TENTATIVAS}× · ${patrimonioLoteCadastrados} cadastrados · ${restantes} na fila…`,
          false
        );
        atualizarProgressoLotePatrimonio(
          c.ok + n,
          c.fila + c.processando + c.ok + c.falhou + restantes + 1,
          `IA (${n}/${totalFilaInicial}) · ${restantes} restantes…`
        );
        try {
          await processarIaParaFotoCaptura(job.fotoId, job.imagens);
        } catch (e) {
          await tratarFalhaIaFotoCaptura(job.fotoId, String(e?.message || e || MSG_IA_FALHOU));
        }
        if (filaIaPatrimonio.length) {
          await new Promise((r) => window.setTimeout(r, PATRIMONIO_IA_INTERVALO_MS));
        }
      }
    }
    iaPatrimonioRodando = false;
    patrimonioLibertarWakeLock();
    patrimonioLoteTotal = 0;
    patrimonioLoteRecebidos = 0;
    atualizarProgressoLotePatrimonio(0, 0, "");
  }

  async function processarIaParaFotoCaptura(fotoId, imagens) {
    const imgs = await imagensParaFotoCapturaAsync(fotoId, imagens);
    if (!imgs.length) {
      await tratarFalhaIaFotoCaptura(fotoId, "Imagem indisponível — reenvie o PDF.");
      return;
    }
    atualizarFotoCaptura(fotoId, { statusIa: "processando", msgIa: "" });
    renderFotosLista();
    const fotoMeta = getFotoCapturaById(fotoId);
    const placaHint = placaDoNomeArquivo(fotoMeta?.nomeArquivo);
    try {
      const leitura = await lerCrlvComRetry(imgs, { placaHint, nomeArquivo: fotoMeta?.nomeArquivo });
      if (!leitura.ok) {
        await tratarFalhaIaFotoCaptura(fotoId, leitura.msg || MSG_NITIDEZ);
        return;
      }
      const campos = leitura.campos;
      const imagemBase = leitura.imagemUsada || imgs[0] || "";
      const pdfFila = await patrimonioLerPdfFila(fotoId);
      let imagemPdfRecortada = pdfFila.startsWith("data:application/pdf")
        ? pdfFila
        : pdfDataUrlParaArmazenar(fotoMeta?.pdfOriginal || "");
      if (!imagemPdfRecortada) {
        const pdfTmp = window.__DK_patrimonioUltimoPdfRecorte;
        if (typeof pdfTmp === "string" && pdfTmp.startsWith("data:application/pdf")) {
          imagemPdfRecortada = pdfTmp;
        }
        window.__DK_patrimonioUltimoPdfRecorte = null;
      }
      const imagemGuardar = await prepararImagemDocumentoArmazenar(imagemBase);
      const scanV = Number(window.__DK_patrimonioScanVersion) || PATRIMONIO_SCAN_VERSAO;
      const doc = {
        ...campos,
        id: newId(),
        imagemRecortada: imagemGuardar,
        imagemPdfRecortada,
        imagemScanVersao: scanV,
        processadoEm: new Date().toISOString(),
        cadastradoEm: new Date().toISOString(),
      };
      const r = await upsertDocumento(doc);
      if (!r.ok) {
        await tratarFalhaIaFotoCaptura(fotoId, r.erro || MSG_NITIDEZ);
        return;
      }
      patrimonioLoteCadastrados++;
      await excluirFotoCapturaAposSucesso(fotoId);
      await patrimonioAplicarLimpezaArquivosEnviados();
      renderFotosLista();
      renderLista();
      setMsg(
        r.substituiu
          ? `Placa ${campos.placa}: PDF e dados substituíram o documento anterior.`
          : `Placa ${campos.placa} cadastrada. Pode anexar o próximo PDF.`,
        false,
        true
      );
    } catch (e) {
      await tratarFalhaIaFotoCaptura(fotoId, String(e?.message || e || MSG_IA_FALHOU));
    }
  }

  function patrimonioYieldUi() {
    return new Promise((resolve) => {
      window.setTimeout(resolve, 16);
    });
  }

  function setPreviewBotoesAtivos(ativo) {
    const ids = [
      "patrimonioPreviewSimBtn",
      "patrimonioPreviewNaoBtn",
      "patrimonioPreviewRetratBtn",
      "patrimonioPreviewAplicarRecorteBtn",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = !ativo;
    });
  }

  async function confirmarFotoPatrimonio(payload) {
    const imagemTratada = payload?.tratada || payload?.url || "";
    const imagemRaw = payload?.raw || imagemTratada;
    if (!imagemTratada && !imagemRaw) return;

    const fotoReg = await registrarFotoCaptura(imagemRaw, imagemTratada);
    if (!fotoReg) {
      setMsg("Não foi possível guardar a foto.", true);
      return;
    }
    renderFotosLista();
    renderLista();
    setMsg(`Foto ${fotoReg.tag} — IA a ler o CRLV…`, false);
    enfileirarIaPatrimonio(fotoReg.id, [imagemTratada, imagemRaw]);
  }

  /** Sim — salvar: fecha ecrã, recorta (se preciso) e envia à fila da IA sem travar o telemóvel. */
  async function finalizarSimSalvarPreview() {
    if (previewSalvando) return;
    previewSalvando = true;
    setPreviewBotoesAtivos(false);

    const cropUi = window.__DK_patrimonioCropUi;
    const cropStage = document.getElementById("patrimonioCropStage");
    const emCantos = cropStage && !cropStage.classList.contains("hidden");

    let raw = previewDataUrlRaw || previewDataUrl;
    let tratada = previewDataUrl || raw;
    const cantos = emCantos ? cropUi?.getCantos?.() : null;

    if (!raw && !tratada) {
      previewSalvando = false;
      setPreviewBotoesAtivos(true);
      return;
    }

    try {
      patrimonioLimparFotoPendente();
      fecharPreview(false);
      renderFotosLista();
      setMsg("A preparar documento…", false);
      await patrimonioYieldUi();

      if (emCantos && cantos && cropUi?.aplicarRecorte) {
        setMsg("A recortar folha (área verde)…", false);
        await patrimonioYieldUi();
        tratada = await cropUi.aplicarRecorte(raw, cantos, { skipScanner: true });
        await patrimonioYieldUi();
      }

      setMsg("A enviar à IA…", false);
      await confirmarFotoPatrimonio({ raw, tratada });
    } catch {
      setMsg("Erro ao guardar. Ajuste os cantos e tente de novo.", true);
      if (raw) void abrirEditorCantosPreview();
    } finally {
      previewSalvando = false;
      setPreviewBotoesAtivos(true);
      previewDataUrl = "";
      previewDataUrlRaw = "";
    }
  }

  function getDocumentos() {
    return loadStore().documentos || [];
  }

  async function upsertDocumento(doc) {
    const placa = resolverPlacaMercosul(doc.placa);
    if (!placa) {
      return {
        ok: false,
        erro: "Placa inválida (padrão LLLNLNN). Confira o PDF e envie de novo.",
      };
    }
    const docNorm = { ...doc, placa, placaNorm: placa };
    const store = loadStore();
    const antigos = store.documentos.filter((d) => documentoMesmaPlaca(d, docNorm));
    const antigo = antigos.length
      ? antigos.reduce((best, d) => (docMs(d) >= docMs(best) ? d : best))
      : null;
    const idsRemover = new Set(antigos.map((d) => d.id));
    const docs = store.documentos.filter((d) => !idsRemover.has(d.id));
    for (const idRem of idsRemover) {
      if (idRem !== antigo?.id) void patrimonioApagarImagensDoc(idRem);
    }
    const agora = new Date().toISOString();
    const docId = antigo?.id || doc.id || newId();
    const imagemRecortada = String(doc.imagemRecortada || "");
    const imagemPdfRecortada = String(doc.imagemPdfRecortada || "");
    let imagemInline = "";
    let imagemDocIdb = false;
    if (imagemRecortada.startsWith("data:image/")) {
      imagemDocIdb = await patrimonioSalvarImagensDoc(docId, {
        imagemRecortada,
        imagemPdfRecortada,
      });
      if (!imagemDocIdb) {
        imagemInline = await comprimirImagemLimite(
          imagemRecortada,
          1800,
          220000,
          PATRIMONIO_PDF_JPEG_QUALITY
        );
      }
    } else {
      await patrimonioSalvarImagensDoc(docId, { imagemRecortada: "", imagemPdfRecortada });
    }
    const registro = {
      ...docNorm,
      id: docId,
      imagemRecortada: imagemInline,
      imagemPdfRecortada: undefined,
      imagemDocIdb,
      pdfDocIdb: Boolean(imagemPdfRecortada.startsWith("data:application/pdf")),
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

  function dataUrlParaBytes(dataUrl) {
    const { base64 } = parseDataUrl(dataUrl);
    if (!base64) return null;
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      return null;
    }
  }

  /** Lê orientação EXIF (JPEG) para corrigir foto do telemóvel deitada/espelhada. */
  function lerOrientacaoExifJpeg(bytes) {
    if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
    let off = 2;
    while (off + 4 < bytes.length) {
      if (bytes[off] !== 0xff) break;
      const marker = bytes[off + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        off += 2;
        continue;
      }
      const len = (bytes[off + 2] << 8) + bytes[off + 3];
      if (len < 2 || off + len > bytes.length) break;
      if (marker === 0xe1) {
        const start = off + 10;
        if (
          start + 6 <= bytes.length &&
          bytes[off + 4] === 0x45 &&
          bytes[off + 5] === 0x78 &&
          bytes[off + 6] === 0x69 &&
          bytes[off + 7] === 0x66
        ) {
          const le = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
          const u16 = (o) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
          const u32 = (o) => {
            const v = le
              ? bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)
              : (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
            return v >>> 0;
          };
          const ifdOff = start + u32(start + 4);
          if (ifdOff + 2 < bytes.length) {
            const n = u16(ifdOff);
            for (let i = 0; i < n; i++) {
              const e = ifdOff + 2 + i * 12;
              if (e + 12 > bytes.length) break;
              if (u16(e) === 0x0112) {
                const o = u16(e + 8);
                return o >= 1 && o <= 8 ? o : 1;
              }
            }
          }
        }
        return 1;
      }
      off += 2 + len;
    }
    return 1;
  }

  function desenharImagemComOrientacaoExif(ctx, img, orient, dw, dh) {
    const o = orient || 1;
    ctx.save();
    switch (o) {
      case 2:
        ctx.translate(dw, 0);
        ctx.scale(-1, 1);
        break;
      case 3:
        ctx.translate(dw, dh);
        ctx.rotate(Math.PI);
        break;
      case 4:
        ctx.translate(0, dh);
        ctx.scale(1, -1);
        break;
      case 5:
        ctx.rotate(0.5 * Math.PI);
        ctx.scale(1, -1);
        break;
      case 6:
        ctx.rotate(0.5 * Math.PI);
        ctx.translate(0, -dh);
        break;
      case 7:
        ctx.rotate(0.5 * Math.PI);
        ctx.translate(dw, -dh);
        ctx.scale(-1, 1);
        break;
      case 8:
        ctx.rotate(-0.5 * Math.PI);
        ctx.translate(-dw, 0);
        break;
      default:
        break;
    }
    const sw = o >= 5 && o <= 8 ? dh : dw;
    const sh = o >= 5 && o <= 8 ? dw : dh;
    ctx.drawImage(img, 0, 0, sw, sh);
    ctx.restore();
  }

  function canvasSizeParaOrientacao(orient, w, h) {
    const o = orient || 1;
    if (o >= 5 && o <= 8) return { w: h, h: w };
    return { w, h };
  }

  async function corrigirOrientacaoImagem(dataUrl) {
    const bytes = dataUrlParaBytes(dataUrl);
    const orient = bytes ? lerOrientacaoExifJpeg(bytes) : 1;
    if (orient === 1) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const { w, h } = canvasSizeParaOrientacao(orient, img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        desenharImagemComOrientacaoExif(ctx, img, orient, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function desenharFrameVideoCamera(ctx, video, cw, ch, track) {
    if (patrimonioTrackEhTraseira(track)) {
      ctx.drawImage(video, 0, 0, cw, ch);
      return;
    }
    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, cw, ch);
    ctx.restore();
  }

  /** Imagem em cores, tamanho adequado à API Vision (alta nitidez para CRLV). */
  async function prepararImagemParaIaCrlv(dataUrl) {
    const orientada = await corrigirOrientacaoImagem(dataUrl);
    return comprimirImagemLimite(
      orientada,
      PATRIMONIO_IA_ENVIO_MAX_PX,
      PATRIMONIO_IA_ENVIO_MAX_B64,
      PATRIMONIO_PDF_JPEG_QUALITY
    );
  }

  function lerExclusoesPatrimonioStandalone() {
    try {
      const raw = JSON.parse(localStorage.getItem(EXCLUSOES_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function gravarExclusoesPatrimonioStandalone(lista) {
    try {
      localStorage.setItem(EXCLUSOES_KEY, JSON.stringify(lista || []));
    } catch {
      /* ignore */
    }
  }

  function todasExclusoesPatrimonio(...listas) {
    return mergeFotosCapturasExcluidas(...listas, lerExclusoesPatrimonioStandalone());
  }

  function persistirExclusoesPatrimonio(exclusoes) {
    const merged = mergeFotosCapturasExcluidas(exclusoes);
    gravarExclusoesPatrimonioStandalone(merged);
    return merged;
  }

  async function comprimirImagem(dataUrl, maxPx, quality) {
    const orientada = await corrigirOrientacaoImagem(dataUrl);
    const { mime, base64 } = parseDataUrl(orientada);
    if (!mime.startsWith("image/") || !base64) return orientada;
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
          resolve(orientada);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", q));
      };
      img.onerror = () => resolve(orientada);
      img.src = orientada;
    });
  }

  /** Comprime só o necessário para caber no limite (IndexedDB ou API). */
  async function comprimirImagemLimite(dataUrl, maxPx, maxLen, qualityStart) {
    const limite = maxLen || 320000;
    let q = qualityStart || 0.9;
    let px = maxPx || 1600;
    let result = await comprimirImagem(dataUrl, px, q);
    for (let i = 0; i < 12; i++) {
      if (parseDataUrl(result).base64.length <= limite) return result;
      if (q > 0.78) q -= 0.03;
      else px = Math.max(1200, Math.round(px * 0.92));
      result = await comprimirImagem(dataUrl, px, q);
    }
    return result;
  }

  function ehArquivoPdf(file) {
    if (!file || !(file.size > 0)) return false;
    const tipo = String(file.type || "").toLowerCase();
    const nome = String(file.name || "");
    if (tipo === "application/pdf" || tipo === "application/x-pdf") return true;
    if (/\.pdf$/i.test(nome)) return true;
    if (/^crlvdigital[_-]/i.test(nome) || /^crlv[_-]/i.test(nome)) return true;
    if (!tipo && file.size >= 400) return true;
    return false;
  }

  function fileParaDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Não foi possível ler o ficheiro."));
      fr.readAsDataURL(file);
    });
  }

  function fileParaArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(new Error("Não foi possível ler o PDF."));
      fr.readAsArrayBuffer(file);
    });
  }

  let pdfJsCarregando = null;

  async function garantirPdfJs() {
    if (window.pdfjsLib?.getDocument) {
      if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}pdf.worker.min.js`;
      }
      return window.pdfjsLib;
    }
    if (pdfJsCarregando) return pdfJsCarregando;
    pdfJsCarregando = new Promise((resolve, reject) => {
      const existente = document.querySelector('script[src*="pdf.min.js"]');
      const onReady = () => {
        const lib = window.pdfjsLib;
        if (!lib?.getDocument) {
          reject(new Error("Biblioteca PDF não disponível."));
          return;
        }
        lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}pdf.worker.min.js`;
        resolve(lib);
      };
      if (existente) {
        if (window.pdfjsLib?.getDocument) onReady();
        else existente.addEventListener("load", onReady, { once: true });
        existente.addEventListener("error", () => reject(new Error("Falha ao carregar PDF.js")), {
          once: true,
        });
        return;
      }
      const s = document.createElement("script");
      s.src = `${PDFJS_CDN}pdf.min.js`;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      s.onload = onReady;
      s.onerror = () => reject(new Error("Falha ao carregar PDF.js"));
      document.head.appendChild(s);
    });
    try {
      return await pdfJsCarregando;
    } finally {
      pdfJsCarregando = null;
    }
  }

  async function renderizarPaginaPdfParaImagem(pdfDoc, pageNum, escala) {
    const page = await pdfDoc.getPage(pageNum);
    const scale = escala || PATRIMONIO_PDF_RENDER_SCALE;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", PATRIMONIO_PDF_JPEG_QUALITY);
  }

  async function pdfArquivoParaImagemAlta(file) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(`Ficheiro demasiado grande (máx. ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB).`);
    }
    const pdfjs = await garantirPdfJs();
    const buf = await fileParaArrayBuffer(file);
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const numPag = pdf.numPages || 1;
    let melhor = null;
    let melhorArea = 0;
    const paginas = numPag > 1 ? [1, 2] : [1];
    for (const p of paginas) {
      if (p > numPag) continue;
      const img = await renderizarPaginaPdfParaImagem(pdf, p, PATRIMONIO_PDF_RENDER_SCALE);
      const { base64 } = parseDataUrl(img);
      const area = base64.length;
      if (area > melhorArea) {
        melhorArea = area;
        melhor = img;
      }
    }
    if (!melhor) throw new Error("PDF sem páginas legíveis.");
    return melhor;
  }

  function pdfDataUrlParaArmazenar(dataUrl) {
    const b64 = parseDataUrl(dataUrl).base64;
    if (!b64 || b64.length > PDF_STORAGE_B64_MAX) return undefined;
    return dataUrl;
  }

  async function registrarArquivoPdf(file, imagemRenderizada) {
    const agora = new Date();
    const fotoId = newFotoId();
    let pdfOriginal = "";
    try {
      pdfOriginal = await fileParaDataUrl(file);
    } catch {
      pdfOriginal = "";
    }
    await patrimonioSalvarImagemFila(fotoId, imagemRenderizada, {
      nomeArquivo: String(file.name || "documento.pdf").slice(0, 120),
      pdfOriginal,
    });
    let imagemMini = "";
    try {
      imagemMini = await comprimirImagemLimite(
        imagemRenderizada,
        640,
        PATRIMONIO_IMAGEM_FILA_MAX_B64,
        0.68
      );
    } catch {
      imagemMini = "";
    }
    const foto = sanitizeFotoCaptura({
      id: fotoId,
      tag: formatTagPatrimonioFoto(agora),
      tipo: "pdf",
      nomeArquivo: String(file.name || "documento.pdf").slice(0, 120),
      registradoEm: agora.toISOString(),
      imagem: imagemMini.startsWith("data:image/") ? imagemMini : "",
      imagemIndisponivel: !imagemMini.startsWith("data:image/"),
      statusIa: "fila",
      docId: "",
      placa: placaDoNomeArquivo(file.name) || "",
      msgIa: "",
      tentativasIa: 0,
      atualizadoEm: agora.toISOString(),
    });
    if (!foto) {
      await patrimonioApagarImagemFila(fotoId);
      return null;
    }
    const store = loadStore();
    store.fotosCapturas = [foto, ...store.fotosCapturas].slice(0, PATRIMONIO_MAX_ARQUIVOS);
    saveStore(store);
    return foto;
  }

  async function processarArquivosPdf(fileList) {
    let files = Array.from(fileList || []).filter(ehArquivoPdf);
    if (!files.length) {
      const total = Array.from(fileList || []).length;
      setMsg(
        total > 0
          ? "Nenhum ficheiro reconhecido como PDF/CRLV. Use .pdf ou ficheiros CRLVDigital_* do gov.br."
          : "Selecione um ou mais ficheiros PDF.",
        true
      );
      return;
    }
    if (files.length > PATRIMONIO_MAX_LOTE) {
      setMsg(
        `Foram selecionados ${files.length} ficheiros — serão processados os primeiros ${PATRIMONIO_MAX_LOTE}.`,
        false
      );
      files = files.slice(0, PATRIMONIO_MAX_LOTE);
    }
    patrimonioLoteTotal = files.length;
    patrimonioLoteRecebidos = 0;
    patrimonioLoteExcluidos = 0;
    patrimonioLoteCadastrados = 0;
    patrimonioConvertendoPdfs = true;
    patrimonioPausarSyncCloud();
    await patrimonioAtivarWakeLock();
    setMsg(`A receber ${files.length} ficheiro(s) (máx. ${PATRIMONIO_MAX_LOTE})…`, false);
    atualizarProgressoLotePatrimonio(0, files.length);
    await patrimonioYieldUi();
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        patrimonioLoteRecebidos = i + 1;
        atualizarProgressoLotePatrimonio(
          i + 1,
          files.length,
          `A converter ${i + 1}/${files.length}: «${file.name}»…`
        );
        setMsg(`A converter ${i + 1}/${files.length}: «${file.name}»…`, false);
        await patrimonioYieldUi();
        const imagem = await pdfArquivoParaImagemAlta(file);
        const foto = await registrarArquivoPdf(file, imagem);
        if (!foto) {
          setMsg(`Não foi possível guardar «${file.name}».`, true);
          continue;
        }
        if (i % 5 === 4) renderFotosLista();
        enfileirarIaPatrimonio(foto.id, []);
        ok++;
      } catch (e) {
        setMsg(`Erro em «${file.name}»: ${String(e?.message || e)}`, true);
      }
    }
    renderLista();
    renderFotosLista();
    patrimonioConvertendoPdfs = false;
    if (ok > 0) {
      setMsg(
        `${ok} PDF(s) na fila da IA (até ${PATRIMONIO_IA_MAX_TENTATIVAS} tentativas cada). Mantenha a página aberta.`,
        false,
        true
      );
      void finalizarLotePatrimonioAposUpload();
    } else {
      patrimonioLibertarWakeLock();
      patrimonioRetomarSyncCloud();
    }
  }

  function obterInputPdf() {
    return document.getElementById("patrimonioPdfInput") || pdfInput;
  }

  function abrirSeletorPdf() {
    const input = obterInputPdf();
    if (input) {
      input.click();
      return;
    }
    setMsg("Seletor de ficheiros indisponível neste navegador.", true);
  }

  function onPatrimonioPdfInputChange(ev) {
    const input = ev?.target || obterInputPdf();
    if (!input) return;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length) return;
    void processarArquivosPdf(files);
  }

  function bindPatrimonioPdfUpload() {
    const input = obterInputPdf();
    if (input && input.dataset.dkPdfBound !== "1") {
      input.dataset.dkPdfBound = "1";
      input.addEventListener("change", onPatrimonioPdfInputChange);
    }

    const zone = document.getElementById("patrimonioPdfDropzone") || pdfDropzone;
    if (!zone || zone.dataset.dkPdfBound === "1") return;
    zone.dataset.dkPdfBound = "1";
    ["dragenter", "dragover"].forEach((evName) => {
      zone.addEventListener(evName, (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        zone.classList.add("patrimonio-pdf-dropzone--drag");
      });
    });
    ["dragleave", "drop"].forEach((evName) => {
      zone.addEventListener(evName, (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        zone.classList.remove("patrimonio-pdf-dropzone--drag");
      });
    });
    zone.addEventListener("drop", (ev) => {
      const files = ev.dataTransfer?.files;
      if (files?.length) void processarArquivosPdf(files);
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

  /**
   * Mapa fixo CRLV-e (SENATRAN): posição de cada VALOR em negrito abaixo da tarja preta superior.
   * Rótulos pequenos ("PLACA", "CÓDIGO RENAVAM") podem estar ilegíveis — use a posição.
   */
  function mapaEspacialCrlvPrompt() {
    return `REFERÊNCIA FIXA — TARJA PRETA NO TOPO (brasão, "REPÚBLICA FEDERATIVA DO BRASIL", SENATRAN, gov.br).
Tudo abaixo dessa tarja mantém o MESMO LUGAR em todo CRLV-e digital. Leia o VALOR EM LETRAS MAIORES/NEGRITO em cada caixa, não o rótulo pequeno acima.

MÉTODO: (1) localize a tarja preta no topo; (2) para cada campo abaixo, leia o dado grande na posição descrita; (3) ignore QR code central-esquerdo.

FAIXA 1 — imediatamente abaixo da tarja (topo do formulário):
• COLUNA ESQUERDA (0–45% largura):
  - codigoRenavam: primeira linha, canto superior esquerdo — 11 dígitos grandes (ex.: 01131834566).
  - placa: linha abaixo do RENAVAM, lado esquerdo — 7 caracteres MAIÚSCULOS em negrito (ex.: PCK8G70). Mercosul LLLNLNN.
  - exercicio: à direita da placa, mesma linha — 4 dígitos do ano (ex.: 2025).
  - anoFabricacao: abaixo da placa, esquerda — 4 dígitos.
  - anoModelo: à direita do ano fabricação — 4 dígitos.
  - numeroCrv: abaixo dos anos — número longo (ex.: 254419349417).
• COLUNA DIREITA (45–100% largura):
  - categoria: topo direito (ex.: PARTICULAR).
  - potenciaCilindrada: abaixo categoria — formato "0CV/162" ou "8CV/150" (copie exato).
  - motor: linha larga abaixo — alfanumérico longo (ex.: KC22E0J110894).
  - carroceria: abaixo motor — ex.: NÃO APLICAVEL / NÃO APLICÁVEL.
  - nome: caixa larga — nome do proprietário em MAIÚSCULAS (ex.: MARCIO JOSE SIQUEIRA DOS SANTOS).
  - cpfCnpj: abaixo ou à direita do nome — CPF 11 dígitos ou CNPJ 14 (ex.: 030.378.974-30).

FAIXA 2 — meio do documento (abaixo do QR / bloco superior):
• ESQUERDA:
  - codigoSegurancaCla: linha com número longo ~11 dígitos (ex.: 71846753390), acima de marca/modelo.
  - marcaModeloVersao: texto longo marca/modelo (ex.: HONDA/CG 160 FAN).
  - especieTipo: abaixo (ex.: PASSAGEIRO MOTOCICLETA).
  - placaAnterior: esquerda — placa/UF ou asteriscos (ex.: PCK8670/PE).
  - chassi: à direita da placa anterior — exatamente 17 caracteres (ex.: 9C2KC2200JR110897).
  - corPredominante: abaixo placa anterior (ex.: BRANCA).
  - combustivel: à direita da cor (ex.: ALCOOL/GASOLINA).
• DIREITA:
  - local: cidade/UF (ex.: PETROLINA PE).
  - data: à direita do local — DD/MM/AAAA (ex.: 24/07/2025).

FAIXA 3 — rodapé (linha tracejada horizontal):
  - observacaoVeiculo: caixa INFERIOR ESQUERDA — texto grande ou "SEM OBSERVAÇÕES".
  - Ignore caixas DPVAT/seguro à direita se só asteriscos (*).`;
  }

  function montarPromptCrlv(revisao, opts) {
    const hintPlaca = String(opts?.placaHint || "").trim();
    const hintNome = String(opts?.nomeArquivo || "").trim();
    const hintExtra =
      hintPlaca || hintNome
        ? `\nDICA DO SISTEMA: ficheiro «${hintNome || "?"}»${hintPlaca ? ` — placa esperada ${hintPlaca} (confirme no documento).` : "."}\n`
        : "";
    const schema = `{"aprovado":true,"confianca":"alta","camposIlegiveis":[],"motivoReprovacao":"","campos":{"codigoRenavam":"","placa":"","exercicio":"","anoFabricacao":"","anoModelo":"","numeroCrv":"","codigoSegurancaCla":"","marcaModeloVersao":"","especieTipo":"","placaAnterior":"","chassi":"","corPredominante":"","combustivel":"","categoria":"","potenciaCilindrada":"","motor":"","carroceria":"","nome":"","cpfCnpj":"","local":"","data":"DD/MM/AAAA","observacaoVeiculo":""}}`;
    const mapa = mapaEspacialCrlvPrompt();
    if (revisao) {
      return `CRLV-e brasileiro — segunda leitura com MAPA DE POSIÇÕES (tarja preta = topo).
${hintExtra}
${mapa}

Responda APENAS JSON: ${schema}

Revise com prioridade: placa (negrito esquerda faixa 1), codigoRenavam (11 dígitos topo esquerdo), chassi (17 chars faixa 2), potenciaCilindrada, observacaoVeiculo (caixa inferior esquerda).
- placa Mercosul LLLNLNN; conte dígitos do RENAVAM um a um.
- Use "aprovado": true se placa, RENAVAM e chassi estiverem corretos.`;
    }
    return `CRLV-e brasileiro (SENATRAN, layout fixo). Extraia os VALORES EM NEGRITO nas posições abaixo — mesmo que rótulos pequenos ("PLACA", "CÓDIGO DE SEGURANÇA") estejam borrados.
${hintExtra}
${mapa}

Responda APENAS JSON válido (sem markdown): ${schema}

REGRAS DE CONTEÚDO:
- placa: 7 caracteres Mercosul LLLNLNN (3 letras + 1 número + 1 letra + 2 números). Posição: esquerda faixa 1. Diferencie 8/B, 0/O, 5/S.
- codigoRenavam: 11 dígitos na primeira linha esquerda.
- chassi: 17 caracteres na faixa 2, à direita de placa anterior.
- potenciaCilindrada: copie exato da caixa direita (ex.: 0CV/162).
- cpfCnpj: só dígitos com pontuação se visível.
- observacaoVeiculo: caixa inferior esquerda; se vazio use "SEM OBSERVAÇÕES".
- carroceria: motocicleta → "NÃO APLICÁVEL" se aplicável.
- NÃO invente dígitos; se a posição estiver legível mas o rótulo não, confie na posição do mapa.
- "aprovado": true quando placa, RENAVAM e chassi forem lidos com confiança.`;
  }

  function preencherDefaultsCrlv(campos, opts) {
    if (!campos || typeof campos !== "object") return;
    const nomeArq = String(opts?.nomeArquivo || "").trim();
    if (!String(campos.exercicio ?? "").trim()) {
      const ex = exercicioDoNomeArquivo(nomeArq);
      if (ex) campos.exercicio = ex;
    }
    if (!String(campos.data ?? "").trim() && /^\d{4}$/.test(String(campos.exercicio || ""))) {
      campos.data = `01/01/${campos.exercicio}`;
    }
    if (!String(campos.nome ?? "").trim()) campos.nome = "PROPRIETÁRIO N/I";
    if (!String(campos.marcaModeloVersao ?? "").trim()) campos.marcaModeloVersao = "N/I";
    const obs = String(campos.observacaoVeiculo ?? "").trim();
    if (!obs || /^[*.\-–—]+$/.test(obs)) {
      campos.observacaoVeiculo = "SEM OBSERVAÇÕES";
    }
    const pa = String(campos.placaAnterior ?? "").trim();
    if (!pa || /^[*]+$/.test(pa)) campos.placaAnterior = "";
    if (!String(campos.carroceria ?? "").trim()) {
      const esp = String(campos.especieTipo ?? "").toUpperCase();
      if (/MOTOC|MOTON|CICLOM/.test(esp)) campos.carroceria = "NÃO APLICÁVEL";
    }
    const opcionais = {
      motor: "N/I",
      potenciaCilindrada: "N/I",
      numeroCrv: "N/I",
      especieTipo: "N/I",
      corPredominante: "N/I",
      combustivel: "N/I",
      categoria: "N/I",
      local: "N/I",
      anoFabricacao: String(campos.exercicio || "").trim() || "N/I",
      anoModelo: String(campos.exercicio || "").trim() || "N/I",
    };
    for (const [k, v] of Object.entries(opcionais)) {
      if (!String(campos[k] ?? "").trim()) campos[k] = v;
    }
    const cla = onlyDigits(campos.codigoSegurancaCla);
    if (cla.length < 9) {
      campos.codigoSegurancaCla = cla.length >= 4 ? cla.padEnd(11, "0").slice(0, 11) : "00000000000";
    }
    const cnpjCpf = onlyDigits(campos.cpfCnpj);
    if (cnpjCpf.length !== 11 && cnpjCpf.length !== 14) {
      campos.cpfCnpj = "N/I";
    }
  }

  function extrairCamposRespostaIa(parsed) {
    if (!parsed || typeof parsed !== "object") return {};
    const aninhado = parsed.campos || parsed.Campos || parsed.dados || parsed.fields || parsed.veiculo;
    if (aninhado && typeof aninhado === "object" && !Array.isArray(aninhado)) {
      return { ...aninhado };
    }
    const out = { ...parsed };
    delete out.aprovado;
    delete out.confianca;
    delete out.camposIlegiveis;
    delete out.motivoReprovacao;
    delete out.motivo_reprovacao;
    return out;
  }

  function msgErroApiIa(data, status) {
    const reason = String(data?.reason || "").trim();
    if (reason === "openai_not_configured") {
      return "IA não configurada no servidor (contacte suporte DK).";
    }
    if (reason === "forbidden_origin") return "Pedido bloqueado (origem inválida).";
    if (reason === "invalid_content") return "Erro interno ao enviar imagem à IA.";
    if (reason === "openai_error") {
      const det = String(data?.error || "").slice(0, 120);
      return det ? `OpenAI: ${det}` : "Erro na API OpenAI.";
    }
    if (reason === "server_error") return String(data?.error || MSG_IA_FALHOU);
    if (status === 413) return "Imagem demasiado grande para a IA — tente outra foto.";
    return String(data?.error || data?.msg || MSG_IA_FALHOU);
  }

  function renavamDigitoVerificador(renavam10) {
    const seq = onlyDigits(renavam10).padStart(10, "0").slice(-10);
    let soma = 0;
    const pesos = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3];
    for (let i = 0; i < 10; i++) {
      soma += Number(seq[9 - i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto <= 1 ? 0 : 11 - resto;
  }

  function renavamValido(renavam) {
    const d = onlyDigits(renavam);
    if (d.length !== 11) return false;
    return renavamDigitoVerificador(d.slice(0, 10)) === Number(d[10]);
  }

  function normalizarRenavamPatrimonio(raw) {
    let d = onlyDigits(raw);
    if (d.length === 11 && renavamValido(d)) return d;
    if (d.length === 12) {
      for (let i = 0; i < 12; i++) {
        const cand = d.slice(0, i) + d.slice(i + 1);
        if (renavamValido(cand)) return cand;
      }
    }
    if (d.length > 11) d = d.slice(0, 11);
    return d;
  }

  function validarLeituraCrlv(parsed, campos, opts) {
    preencherDefaultsCrlv(campos, opts);

    for (const key of CAMPOS_CRITICOS) {
      if (!String(campos[key] ?? "").trim()) {
        const label = CAMPOS_ORDEM.find((c) => c.key === key)?.label || key;
        return {
          ok: false,
          msg: `IA não leu «${label}». Envie outro PDF ou toque em Revisar IA.`,
          field: key,
        };
      }
    }

    if (!placaValida(campos.placa)) {
      const hint = placaDoNomeArquivo(opts?.nomeArquivo);
      if (hint && placaValida(hint)) {
        campos.placa = hint;
      } else {
        return { ok: false, msg: "Placa inválida na leitura — confira Mercosul (LLLNLNN).", field: "placa" };
      }
    }
    const renavam = normalizarRenavamPatrimonio(campos.codigoRenavam);
    if (onlyDigits(renavam).length !== 11) {
      return { ok: false, msg: "RENAVAM deve ter 11 dígitos.", field: "codigoRenavam" };
    }
    campos.codigoRenavam = renavam;
    if (!chassiValido(campos.chassi)) {
      return { ok: false, msg: "Chassi inválido (17 caracteres).", field: "chassi" };
    }
    if (!dataBrValida(campos.data)) {
      const ex = String(campos.exercicio || "").trim();
      if (/^\d{4}$/.test(ex)) campos.data = `01/01/${ex}`;
      else campos.data = "01/01/2026";
    }
    if (!/^\d{4}$/.test(String(campos.exercicio || ""))) {
      const ano = String(campos.data || "").match(/(\d{4})\s*$/);
      if (ano) campos.exercicio = ano[1];
      else campos.exercicio = String(new Date().getFullYear());
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

  async function aplicarRecortePreviewAtual() {
    const raw = previewDataUrlRaw;
    const cropUi = window.__DK_patrimonioCropUi;
    const cantos = cropUi?.getCantos?.();
    if (!raw || !cantos || !cropUi?.aplicarRecorte) return false;
    const pergunta = document.querySelector(".patrimonio-crop-instrucao");
    if (pergunta) pergunta.textContent = "A recortar folha (área verde)…";
    setMsg("A recortar e ajustar documento…", false);
    try {
      const tratada = await cropUi.aplicarRecorte(raw, cantos, { skipScanner: true });
      cropUi.fechar();
      previewDataUrl = tratada;
      if (previewImg) {
        previewImg.src = tratada;
        previewImg.classList.remove("hidden");
      }
      patrimonioGuardarFotoPendente(tratada);
      if (pergunta) {
        pergunta.textContent =
          "Recorte aplicado. Confira abaixo ou volte a «Ajustar cantos». Sim — salvar para enviar à IA.";
      }
      setMsg("", false);
      return true;
    } catch {
      if (pergunta) {
        pergunta.textContent = "Ajuste os 4 cantos da folha (vermelho). Área verde = recorte. Roda do rato ou pinça para zoom.";
      }
      setMsg("Não foi possível recortar. Ajuste os cantos e tente de novo.", true);
      return false;
    }
  }

  async function abrirEditorCantosPreview() {
    const raw = previewDataUrlRaw;
    if (!raw || !window.__DK_patrimonioCropUi?.abrir) return;
    if (previewImg) previewImg.classList.add("hidden");
    const pergunta = document.querySelector(".patrimonio-crop-instrucao");
    if (pergunta) {
      pergunta.textContent =
        "O sistema localiza os cantos da folha (pontos vermelhos). Arraste com o dedo ou rato para corrigir.";
    }
    setMsg("A localizar cantos da folha…", false);
    try {
      const r = await window.__DK_patrimonioCropUi.abrir(raw);
      if (r?.auto) {
        setMsg(
          "Cantos detectados automaticamente. Confira os pontos vermelhos e ajuste se necessário.",
          false,
          true
        );
      } else {
        setMsg(
          "Não foi possível localizar a folha — ajuste os 4 pontos vermelhos manualmente ou toque em «Detectar cantos».",
          true
        );
      }
    } catch {
      setMsg("Não foi possível abrir o editor de recorte.", true);
    }
  }

  async function redetectarCantosPreview() {
    const cropUi = window.__DK_patrimonioCropUi;
    if (!cropUi?.redetectarCantos) return;
    setMsg("A localizar cantos da folha…", false);
    try {
      const r = await cropUi.redetectarCantos();
      if (r?.auto) {
        setMsg("Cantos atualizados. Arraste os pontos vermelhos se precisar corrigir.", false, true);
      } else {
        setMsg("Detecção automática falhou — ajuste os pontos vermelhos à mão.", true);
      }
    } catch {
      setMsg("Não foi possível detectar os cantos.", true);
    }
  }

  async function prepararEExibirPreview(dataUrlRaw) {
    const orientada = await corrigirOrientacaoImagem(dataUrlRaw);
    const reduzida = await comprimirImagem(orientada, 1400, 0.9);
    previewDataUrlRaw = reduzida;
    previewDataUrl = reduzida;
    patrimonioGuardarFotoPendente(reduzida);
    mostrarPreview(reduzida);
    await abrirEditorCantosPreview();
  }

  async function chamarIaCrlv(dataUrl, revisao, opts) {
    const parsed = parseDataUrl(dataUrl);
    const content = [
      { type: "text", text: montarPromptCrlv(Boolean(revisao), opts) },
      {
        type: "image_url",
        image_url: {
          url: `data:${parsed.mime};base64,${parsed.base64}`,
          detail: "high",
        },
      },
    ];
    const maxTentativas = 8;
    for (let t = 0; t < maxTentativas; t++) {
      try {
        const res = await fetch("/api/openai-comprovante", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, tipo: "crlv", max_tokens: 4096 }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 429 || (data?.reason === "openai_error" && /rate|429|limit/i.test(String(data?.error)))) {
          await new Promise((r) => window.setTimeout(r, 1500 * (t + 1)));
          continue;
        }
        if (res.ok && data.ok && data.parsed) return { ok: true, parsed: data.parsed };
        return { ok: false, msg: msgErroApiIa(data, res.status) };
      } catch (e) {
        if (t === maxTentativas - 1) return { ok: false, msg: String(e?.message || e) };
        await new Promise((r) => window.setTimeout(r, 1200 * (t + 1)));
      }
    }
    return { ok: false, msg: "OpenAI ocupada (limite de pedidos). Tente Revisar IA em instantes." };
  }

  async function lerCrlvComRetry(imagens, opts) {
    const fontes = [...new Set((imagens || []).filter(Boolean))];
    let ultimo = { ok: false, msg: MSG_IA_FALHOU };
    const iaOpts = {
      placaHint: opts?.placaHint || "",
      nomeArquivo: opts?.nomeArquivo || "",
    };

    for (let i = 0; i < fontes.length; i++) {
      const img = await prepararImagemParaIaCrlv(fontes[i]);
      const { base64 } = parseDataUrl(img);
      if (!base64 || base64.length < 5000) {
        ultimo = { ok: false, msg: "Imagem vazia ou corrompida para a IA." };
        continue;
      }
      for (const revisao of [false, true, true]) {
        const oai = await chamarIaCrlv(img, revisao, iaOpts);
        if (!oai.ok) {
          ultimo = oai;
          const msg = String(oai.msg || "");
          if (/n[aã]o configurada|openai_not_configured/i.test(msg)) {
            return ultimo;
          }
          continue;
        }
        const campos = normalizarCampos(oai.parsed);
        if (!placaValida(campos.placa) && iaOpts.placaHint) {
          campos.placa = iaOpts.placaHint;
        }
        preencherDefaultsCrlv(campos, { nomeArquivo: iaOpts.nomeArquivo });
        const val = validarLeituraCrlv(oai.parsed, campos, { nomeArquivo: iaOpts.nomeArquivo });
        if (val.ok) return { ok: true, campos, parsed: oai.parsed, imagemUsada: fontes[i] };
        ultimo = val;
      }
    }
    return ultimo;
  }

  function normalizarCampos(raw) {
    const c = extrairCamposRespostaIa(raw);
    const aliases = {
      codigo_renavam: "codigoRenavam",
      renavam: "codigoRenavam",
      codigo_seguranca_cla: "codigoSegurancaCla",
      cla: "codigoSegurancaCla",
      marca_modelo_versao: "marcaModeloVersao",
      marca_modelo: "marcaModeloVersao",
      cpf_cnpj: "cpfCnpj",
      numero_crv: "numeroCrv",
      placa_anterior: "placaAnterior",
      cor_predominante: "corPredominante",
      potencia_cilindrada: "potenciaCilindrada",
      especie_tipo: "especieTipo",
      observacao_veiculo: "observacaoVeiculo",
      ano_fabricacao: "anoFabricacao",
      ano_modelo: "anoModelo",
    };
    const out = {};
    for (const { key } of CAMPOS_ORDEM) {
      let v = c[key];
      if (v == null || v === "") {
        const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
        v = c[snake] ?? c[aliases[snake]];
      }
      out[key] = String(v ?? "").trim();
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
    if (out.codigoRenavam) out.codigoRenavam = normalizarRenavamPatrimonio(out.codigoRenavam);
    if (out.codigoSegurancaCla) out.codigoSegurancaCla = onlyDigits(out.codigoSegurancaCla).slice(0, 11);
    preencherDefaultsCrlv(out);
    return out;
  }

  async function processarFotoConfirmada(dataUrlEntrada, dataUrlRawEntrada) {
    await confirmarFotoPatrimonio({
      raw: dataUrlRawEntrada || dataUrlEntrada,
      tratada: dataUrlEntrada,
    });
  }

  async function revisarFotoCapturaComIa(fotoId) {
    const foto = getFotoCapturaById(fotoId);
    if (!foto) return;
    const imgs = await imagensParaFotoCapturaAsync(fotoId, null);
    if (!imgs.length) {
      setMsg("Imagem indisponível — reenvie o PDF deste veículo.", true);
      return;
    }
    atualizarFotoCaptura(fotoId, { statusIa: "fila", msgIa: "", tentativasIa: 0 });
    if (fotoCapturaStatusEl) fotoCapturaStatusEl.textContent = "Na fila da IA…";
    setMsg(`Arquivo ${foto.nomeArquivo || foto.tag} na fila para revisão com IA…`, false);
    enfileirarIaPatrimonio(fotoId, imgs);
    renderFotosLista();
  }

  async function reprocessarTodosReprovadosPatrimonio() {
    const fotos = getFotosCapturas().filter((f) => fotoEstaPendenteIa(f));
    if (!fotos.length) {
      setMsg("Nenhum arquivo pendente para reprocessar.", true);
      return;
    }
    let n = 0;
    patrimonioPausarSyncCloud();
    for (const f of fotos) {
      if (!(await patrimonioFilaTemImagem(f.id))) continue;
      atualizarFotoCaptura(f.id, { statusIa: "fila", msgIa: "", tentativasIa: 0 });
      enfileirarIaPatrimonio(f.id, []);
      n++;
    }
    renderFotosLista();
    if (n > 0) {
      setMsg(
        `${n} arquivo(s) na fila (até ${PATRIMONIO_IA_MAX_TENTATIVAS} tentativas cada). Aguarde…`,
        false,
        true
      );
      void finalizarLotePatrimonioAposUpload();
    } else {
      setMsg("Pendentes sem imagem guardada — reenvie os PDFs.", true);
      patrimonioRetomarSyncCloud();
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
    patrimonioCameraDeviceId = "";
    atualizarUiFlash();
    void pararCamera();
    cameraOverlay?.classList.add("hidden");
    cameraOverlay?.setAttribute("aria-hidden", "true");
    if (syncHistory) patrimonioSyncHistoryAposFechar();
  }

  function fecharPreview(syncHistory = true, limparUrls = false) {
    window.__DK_patrimonioCropUi?.fechar?.();
    previewOverlay?.classList.add("hidden");
    previewOverlay?.setAttribute("aria-hidden", "true");
    if (limparUrls) {
      previewDataUrl = "";
      previewDataUrlRaw = "";
    }
    if (previewImg) {
      previewImg.removeAttribute("src");
      previewImg.classList.add("hidden");
    }
    if (syncHistory) patrimonioSyncHistoryAposFechar();
  }

  function atualizarUiFlash() {
    const btn = document.getElementById("patrimonioCameraFlashBtn");
    if (!btn) return;
    btn.setAttribute("aria-pressed", patrimonioFlashLigado ? "true" : "false");
    if (btn.dataset.flashDisponivel === "0") {
      btn.textContent = "Flash: N/A";
      btn.disabled = true;
      return;
    }
    btn.disabled = false;
    btn.textContent = patrimonioFlashLigado ? "Flash: on" : "Flash: off";
  }

  function patrimonioDispositivoSemLanternaWeb() {
    const ua = String(navigator.userAgent || "");
    return (
      /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function patrimonioEhAndroid() {
    return /Android/i.test(String(navigator.userAgent || ""));
  }

  /** Galaxy S24 Ultra e outros Samsung — torch exige câmera traseira exacta. */
  function patrimonioEhAndroidSamsung() {
    const ua = String(navigator.userAgent || "");
    return /Android/i.test(ua) && (/Samsung/i.test(ua) || /\bSM-S/i.test(ua));
  }

  function patrimonioMaxPxCaptura() {
    return patrimonioEhAndroidSamsung() ? 2200 : 1400;
  }

  function abrirCameraTelefoneNativa() {
    patrimonioPersistirAreaPortal();
    fecharCamera(false);
    const dica = patrimonioEhAndroidSamsung()
      ? "Galaxy: na câmera Samsung, toque no ícone ⚡ (flash) antes de fotografar o CRLV."
      : "Use o flash da câmera do telemóvel para foto legível do CRLV.";
    setMsg(dica, false);
    fileFallback?.click();
  }

  function patrimonioTrackCaps(track) {
    if (!track?.getCapabilities) return {};
    try {
      return track.getCapabilities();
    } catch {
      return {};
    }
  }

  function patrimonioLanternaDisponivel(track) {
    if (!track) return false;
    if (patrimonioEhAndroid()) return true;
    const caps = patrimonioTrackCaps(track);
    if ("torch" in caps) return true;
    if (Array.isArray(caps.fillLightMode) && caps.fillLightMode.some((m) => m === "flash" || m === "auto")) {
      return true;
    }
    return typeof ImageCapture !== "undefined";
  }

  async function aplicarFlashCamera() {
    if (!cameraStream) return { ok: false, motivo: "sem_stream" };
    const track = cameraStream.getVideoTracks()[0];
    if (!track) return { ok: false, motivo: "sem_track" };

    const btn = document.getElementById("patrimonioCameraFlashBtn");
    const ligar = patrimonioFlashLigado;

    if (!ligar) {
      const caps = patrimonioTrackCaps(track);
      const metodosOff = [
        () => track.applyConstraints({ advanced: [{ torch: false }] }),
        () => track.applyConstraints({ torch: false }),
      ];
      if (Array.isArray(caps.fillLightMode) && caps.fillLightMode.includes("off")) {
        metodosOff.push(() => track.applyConstraints({ fillLightMode: "off" }));
      }
      for (const fn of metodosOff) {
        try {
          await fn();
          if (btn) btn.dataset.flashDisponivel = "1";
          return { ok: true };
        } catch {
          /* ignore */
        }
      }
      if (btn) btn.dataset.flashDisponivel = "1";
      return { ok: true };
    }

    if (!patrimonioTrackEhTraseira(track)) {
      return { ok: false, motivo: "camera_errada" };
    }

    if (!patrimonioLanternaDisponivel(track) && !patrimonioTrackTemTorch(track)) {
      if (btn) btn.dataset.flashDisponivel = "0";
      return { ok: false, motivo: "nao_suportado" };
    }
    if (btn) btn.dataset.flashDisponivel = "1";

    const caps = patrimonioTrackCaps(track);
    const metodos = [];

    if ("torch" in caps) {
      metodos.push(() => track.applyConstraints({ advanced: [{ torch: true }] }));
      metodos.push(() => track.applyConstraints({ torch: true }));
      if (caps.zoom) {
        metodos.push(() =>
          track.applyConstraints({
            advanced: [{ torch: true, zoom: caps.zoom.min ?? 1 }],
          })
        );
      }
    }
    if (Array.isArray(caps.fillLightMode)) {
      if (caps.fillLightMode.includes("flash")) {
        metodos.push(() => track.applyConstraints({ fillLightMode: "flash" }));
        metodos.push(() => track.applyConstraints({ advanced: [{ fillLightMode: "flash" }] }));
      }
    }

    for (const fn of metodos) {
      try {
        await fn();
        const st = track.getSettings?.() || {};
        if (st.torch === true) return { ok: true };
        if (st.fillLightMode === "flash") return { ok: true };
      } catch {
        /* tentar próximo método */
      }
    }

    if (patrimonioEhAndroid() && metodos.length) {
      return { ok: true, aviso: "torch_nao_confirmado" };
    }
    return { ok: false, motivo: metodos.length ? "constraint_falhou" : "nao_suportado" };
  }

  async function aplicarFlashCameraComReforco() {
    let r = await aplicarFlashCamera();
    if (!patrimonioFlashLigado) return r;
    if (patrimonioEhAndroidSamsung() && !r.ok) {
      await new Promise((resolve) => setTimeout(resolve, 220));
      r = await aplicarFlashCamera();
    }
    if (patrimonioEhAndroidSamsung() && r.ok) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      await aplicarFlashCamera();
    }
    return r;
  }

  /** Alguns Android iniciam a câmera com zoom digital > 1 — força o mínimo. */
  async function normalizarCameraSemZoom(track) {
    if (!track?.getCapabilities) return;
    const caps = patrimonioTrackCaps(track);
    const advanced = [];
    if (caps.zoom) {
      const zMin = typeof caps.zoom.min === "number" ? caps.zoom.min : 1;
      advanced.push({ zoom: zMin });
    }
    if (patrimonioFlashLigado && "torch" in caps) {
      advanced.push({ torch: true });
    } else if (caps.torch && patrimonioFlashLigado) {
      advanced.push({ torch: true });
    }
    if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
      advanced.push({ focusMode: "continuous" });
    }
    if (!advanced.length) return;
    try {
      await track.applyConstraints({ advanced });
    } catch {
      if (caps.zoom) {
        try {
          await track.applyConstraints({ zoom: caps.zoom.min ?? 1 });
        } catch {
          /* ignore */
        }
      }
    }
  }

  async function obterStreamCameraPatrimonio() {
    const tentativas = [];

    if (patrimonioFlashLigado) {
      tentativas.push(
        () =>
          navigator.mediaDevices.getUserMedia({
            video: { ...patrimonioVideoConstraintsBase(), advanced: [{ torch: true }] },
            audio: false,
          }),
        () =>
          navigator.mediaDevices.getUserMedia({
            video: { ...patrimonioVideoConstraintsBase({ torch: true }) },
            audio: false,
          })
      );
    }

    tentativas.push(
      () =>
        navigator.mediaDevices.getUserMedia({
          video: patrimonioVideoConstraintsBase({ resizeMode: "none" }),
          audio: false,
        }),
      () =>
        navigator.mediaDevices.getUserMedia({
          video: patrimonioVideoConstraintsBase(),
          audio: false,
        }),
      () =>
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })
    );

    for (const fn of tentativas) {
      try {
        const stream = await fn();
        const track = stream.getVideoTracks()[0];
        if (track && !patrimonioTrackEhTraseira(track) && patrimonioCameraDeviceId) {
          stream.getTracks().forEach((t) => t.stop());
          continue;
        }
        return stream;
      } catch {
        /* próxima tentativa */
      }
    }
    throw new Error("camera_indisponivel");
  }

  async function conectarStreamCameraPatrimonio(opcoes) {
    const forcarDetectar = Boolean(opcoes?.forcarDetectar);
    if (forcarDetectar || !patrimonioCameraDeviceId) {
      patrimonioCameraDeviceId = await patrimonioDetectarCameraTraseiraComLanterna();
    }
    await pararCamera();
    cameraStream = await obterStreamCameraPatrimonio();
    let track = cameraStream.getVideoTracks()[0];

    if (track && !patrimonioTrackEhTraseira(track)) {
      patrimonioCameraDeviceId = await patrimonioDetectarCameraTraseiraComLanterna();
      await pararCamera();
      cameraStream = await obterStreamCameraPatrimonio();
      track = cameraStream.getVideoTracks()[0];
    }

    if (track) await normalizarCameraSemZoom(track);
    if (cameraVideo) {
      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play();
    }
    if (patrimonioEhAndroidSamsung() && patrimonioFlashLigado) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    const flashBtn = document.getElementById("patrimonioCameraFlashBtn");
    if (flashBtn && track) {
      flashBtn.dataset.flashDisponivel = patrimonioLanternaDisponivel(track) ? "1" : "0";
    }
    return aplicarFlashCameraComReforco();
  }

  async function abrirCameraNativa() {
    fecharPreview(false);
    patrimonioPersistirAreaPortal();
    if (patrimonioDispositivoSemLanternaWeb()) {
      abrirCameraTelefoneNativa();
      return;
    }
    if (!cameraOverlay || !cameraVideo) {
      fileFallback?.click();
      return;
    }
    patrimonioFlashLigado = true;
    cameraOverlay.classList.remove("hidden");
    cameraOverlay.setAttribute("aria-hidden", "false");
    patrimonioNotificarOverlayAberto();
    const flashBtn = document.getElementById("patrimonioCameraFlashBtn");
    if (flashBtn) flashBtn.dataset.flashDisponivel = "1";
    atualizarUiFlash();
    if (!navigator.mediaDevices?.getUserMedia) {
      fecharCamera();
      fileFallback?.click();
      return;
    }
    try {
      const r = await conectarStreamCameraPatrimonio({ forcarDetectar: true });
      if (!r.ok && patrimonioFlashLigado && r.motivo !== "camera_errada") {
        setMsg(
          patrimonioEhAndroidSamsung()
            ? "Galaxy: flash ON — se a luz não acender, use «Câmera nativa do telemóvel (flash)»."
            : "Flash ON — se a luz não acender, use «Câmera nativa do telemóvel (flash)».",
          true
        );
      } else if (r.motivo === "camera_errada") {
        setMsg("A trocar para a câmera traseira principal…", false);
        await conectarStreamCameraPatrimonio({ forcarDetectar: true });
      }
    } catch {
      fecharCamera();
      setMsg("Permita o acesso à câmera ou use o seletor de ficheiro.", true);
      fileFallback?.click();
    }
  }

  async function alternarFlashCamera() {
    patrimonioFlashLigado = !patrimonioFlashLigado;
    atualizarUiFlash();

    let r = await aplicarFlashCameraComReforco();
    if (!r.ok && patrimonioFlashLigado) {
      try {
        r = await conectarStreamCameraPatrimonio({ forcarDetectar: true });
      } catch {
        r = { ok: false, motivo: "stream_falhou" };
      }
    }

    if (!r.ok && patrimonioFlashLigado) {
      setMsg(
        r.motivo === "camera_errada"
          ? "Câmera errada detectada — a usar a traseira principal. Toque Flash de novo."
          : patrimonioEhAndroidSamsung()
            ? "Flash fica ON. Se a luz não acender, use «Câmera nativa do telemóvel (flash)» e ⚡."
            : "Flash fica ON. Se a luz não acender, use «Câmera nativa do telemóvel (flash)».",
        true
      );
      return;
    }

    setMsg("", false);
  }

  async function capturarComImageCaptureFlash() {
    const track = cameraStream?.getVideoTracks?.()?.[0];
    if (!track || typeof ImageCapture === "undefined") return null;
    try {
      const ic = new ImageCapture(track);
      const photoSettings = {};
      try {
        const caps = ic.getPhotoCapabilities ? await ic.getPhotoCapabilities() : null;
        const modes = caps?.fillLightMode;
        if (Array.isArray(modes)) {
          if (modes.includes("flash")) photoSettings.fillLightMode = "flash";
          else if (modes.includes("auto")) photoSettings.fillLightMode = "auto";
        }
      } catch {
        /* ignore */
      }
      if (patrimonioFlashLigado) await aplicarFlashCameraComReforco();
      const blob = await ic.takePhoto(photoSettings);
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || "") || null);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function capturarDaCamera() {
    if (!cameraVideo || !cameraCanvas) return;
    let dataUrl = null;
    if (patrimonioFlashLigado) {
      dataUrl = await capturarComImageCaptureFlash();
    }
    if (!dataUrl) {
      const vw = cameraVideo.videoWidth;
      const vh = cameraVideo.videoHeight;
      if (!vw || !vh) return;
      if (patrimonioFlashLigado) await aplicarFlashCameraComReforco();
      const maxLado = patrimonioMaxPxCaptura();
      const escala = Math.min(1, maxLado / Math.max(vw, vh));
      const cw = Math.max(1, Math.round(vw * escala));
      const ch = Math.max(1, Math.round(vh * escala));
      cameraCanvas.width = cw;
      cameraCanvas.height = ch;
      const ctx = cameraCanvas.getContext("2d");
      if (!ctx) return;
      const track = cameraStream?.getVideoTracks?.()?.[0];
      desenharFrameVideoCamera(ctx, cameraVideo, cw, ch, track);
      dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.88);
      dataUrl = await corrigirOrientacaoImagem(dataUrl);
    }
    fecharCamera(false);
    void prepararEExibirPreview(dataUrl);
  }

  let unbindZoomViewerDoc = null;
  let unbindZoomViewerFoto = null;

  function bindZoomViewerDoc() {
    const crop = window.__DK_patrimonioCropUi;
    const vp = document.getElementById("patrimonioImagemViewerZoom");
    const inner = vp?.querySelector(".patrimonio-viewer-zoom-inner");
    if (!crop?.bindZoomPan || !vp || !inner) return;
    if (unbindZoomViewerDoc) unbindZoomViewerDoc();
    unbindZoomViewerDoc = crop.bindZoomPan(vp, inner, { minScale: 0.5, maxScale: 8 });
  }

  function bindZoomViewerFoto() {
    const crop = window.__DK_patrimonioCropUi;
    const vp = document.getElementById("patrimonioFotoCapturaViewerZoom");
    const inner = vp?.querySelector(".patrimonio-viewer-zoom-inner");
    if (!crop?.bindZoomPan || !vp || !inner) return;
    if (unbindZoomViewerFoto) unbindZoomViewerFoto();
    unbindZoomViewerFoto = crop.bindZoomPan(vp, inner, { minScale: 0.5, maxScale: 8 });
  }

  function mostrarPreview(dataUrl) {
    if (!previewOverlay) return;
    previewDataUrl = dataUrl;
    previewOverlay.classList.remove("hidden");
    previewOverlay.setAttribute("aria-hidden", "false");
    patrimonioNotificarOverlayAberto();
  }

  function renderLista() {
    const docs = getDocumentos().slice().sort((a, b) => normPlaca(a.placa).localeCompare(normPlaca(b.placa)));
    if (resumoEl) {
      resumoEl.textContent =
        docs.length > 0
          ? `${docs.length} veículo(s) · mesma placa = um documento (novo PDF substitui o anterior).`
          : "Nenhum CRLV cadastrado. Anexe PDFs na área abaixo.";
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
        void patrimonioApagarImagensDoc(id);
        saveStore({ documentos: store.documentos.filter((d) => d.id !== id) });
        renderLista();
      });
    });
    renderFotosLista();
  }

  function getFotosCapturasEmProcessamento() {
    return getFotosCapturas().filter((f) => fotoEstaPendenteIa(f));
  }

  function renderFotosLista() {
    const fotos = getFotosCapturasEmProcessamento();
    const docsN = getDocumentos().length;
    if (fotosResumoEl) {
      fotosResumoEl.textContent = fotos.length
        ? `${docsN} veículo(s) cadastrados · ${fotos.length} a processar (até ${PATRIMONIO_IA_MAX_TENTATIVAS}× cada).`
        : docsN > 0
          ? `${docsN} veículo(s) cadastrados. Nenhum arquivo em processamento.`
          : "Nenhum PDF em processamento.";
    }
    if (!fotosListaEl) return;
    if (!fotos.length) {
      fotosListaEl.innerHTML = '<p class="subtext">Sem arquivos em processamento.</p>';
      return;
    }
    fotosListaEl.innerHTML = fotos
      .map((f) => {
        const st = String(f.statusIa || "").toLowerCase();
        const podeRevisar =
          (st === "fila" || st === "processando") && imagensParaFotoCaptura(f.id, null).length > 0;
        const nome = f.nomeArquivo ? escapeHtml(f.nomeArquivo) : "";
        return `<div class="patrimonio-foto-item${st === "processando" ? " patrimonio-foto-item--proc" : ""}">
          <button type="button" class="patrimonio-foto-link" data-foto-id="${escapeHtml(f.id)}" title="Abrir ${escapeHtml(formatTagPatrimonioFotoLegivel(f.tag))}">
            <span class="patrimonio-foto-tag">${escapeHtml(f.tag)}</span>
            ${nome ? `<span class="patrimonio-foto-nome">${nome}</span>` : ""}
          </button>
          <span class="${classeStatusFotoCaptura(f)}" title="${escapeHtml(f.msgIa || "")}">${escapeHtml(labelStatusArquivoCaptura(f))}</span>
          <div class="patrimonio-foto-item__acoes">
            ${podeRevisar ? `<button type="button" class="btn-primary btn-secondary-outline patrimonio-foto-revisar" data-foto-id="${escapeHtml(f.id)}">Revisar IA</button>` : ""}
            <button type="button" class="btn-primary btn-secondary-outline patrimonio-foto-excluir" data-foto-id="${escapeHtml(f.id)}">Excluir</button>
          </div>
        </div>`;
      })
      .join("");
    fotosListaEl.querySelectorAll(".patrimonio-foto-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-foto-id");
        if (id) void abrirViewerFotoCaptura(id);
      });
    });
    fotosListaEl.querySelectorAll(".patrimonio-foto-revisar").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute("data-foto-id");
        if (id) void revisarFotoCapturaComIa(id);
      });
    });
    fotosListaEl.querySelectorAll(".patrimonio-foto-excluir").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute("data-foto-id");
        if (id) excluirFotoCaptura(id);
      });
    });
  }

  async function abrirViewerFotoCaptura(id) {
    const foto = getFotoCapturaById(id);
    if (!foto || !fotoCapturaViewer || !fotoCapturaViewerImg) return;
    const alta = await patrimonioLerImagemFila(id);
    const url = alta?.startsWith("data:image/") ? alta : foto.imagem;
    if (!String(url || "").startsWith("data:image/")) {
      setMsg("Imagem indisponível neste dispositivo. Reenvie o PDF.", true);
      return;
    }
    fotoCapturaViewerImg.src = url;
    fotoCapturaViewer.dataset.fotoId = id;
    if (fotoCapturaTagEl) fotoCapturaTagEl.textContent = foto.tag;
    if (fotoCapturaStatusEl) {
      fotoCapturaStatusEl.textContent = [
        labelStatusArquivoCaptura(foto),
        foto.nomeArquivo ? ` · ${foto.nomeArquivo}` : "",
      ].join("");
    }
    const btnRevisar = document.getElementById("patrimonioFotoCapturaRevisarBtn");
    if (btnRevisar) btnRevisar.disabled = false;
    fotoCapturaViewer.classList.remove("hidden");
    fotoCapturaViewer.setAttribute("aria-hidden", "false");
    bindZoomViewerFoto();
    patrimonioNotificarOverlayAberto();
  }

  function fecharViewerFotoCaptura(syncHistory = true) {
    fotoCapturaViewer?.classList.add("hidden");
    fotoCapturaViewer?.setAttribute("aria-hidden", "true");
    if (fotoCapturaViewerImg) fotoCapturaViewerImg.removeAttribute("src");
    if (fotoCapturaViewer) delete fotoCapturaViewer.dataset.fotoId;
    if (unbindZoomViewerFoto) {
      unbindZoomViewerFoto();
      unbindZoomViewerFoto = null;
    }
    if (syncHistory) patrimonioSyncHistoryAposFechar();
  }

  async function excluirFotoCaptura(id) {
    if (!id || !window.confirm("Excluir este arquivo enviado?")) return;
    await patrimonioApagarImagemFila(id);
    if (!excluirFotoCapturaRegistro(id)) return;
    fecharViewerFotoCaptura();
    renderFotosLista();
    setMsg("Arquivo excluído permanentemente.", false, true);
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      try {
        await window.__DK_pushCloudSnapshotNow();
        renderFotosLista();
      } catch (e) {
        console.warn("[DK patrimônio] push após excluir foto", e);
      }
    }
  }

  function getDocById(id) {
    return getDocumentos().find((d) => d.id === id) || null;
  }

  async function abrirViewerImagem(id) {
    const doc = getDocById(id);
    if (!doc || !imagemViewer || !imagemViewerImg) return;

    let url = doc.imagemRecortada;
    if (!url?.startsWith("data:image/")) {
      const idb = await patrimonioLerImagensDoc(id);
      if (idb?.imagemRecortada) url = idb.imagemRecortada;
    }
    if (!url?.startsWith("data:image/")) {
      setMsg("Imagem indisponível — reenvie o PDF deste veículo.", true);
      return;
    }

    if (typeof window.__DK_patrimonioRetocarImagem === "function") {
      try {
        const retocada = await window.__DK_patrimonioRetocarImagem(url);
        if (retocada && retocada !== url) {
          url = retocada;
          await patrimonioSalvarImagensDoc(id, {
            imagemRecortada: await prepararImagemDocumentoArmazenar(url),
            imagemPdfRecortada: "",
          });
          const store = loadStore();
          const idx = store.documentos.findIndex((d) => d.id === id);
          if (idx >= 0) {
            store.documentos[idx].imagemScanVersao = PATRIMONIO_SCAN_VERSAO;
            store.documentos[idx].imagemAtualizadaEm = new Date().toISOString();
            store.documentos[idx].imagemDocIdb = true;
            saveStore(store);
          }
        }
      } catch {
        /* mostrar original */
      }
    }

    imagemViewerImg.src = url;
    imagemViewer.dataset.patId = id;
    const pdfBtn = document.getElementById("patrimonioImagemPdfBtn");
    if (pdfBtn) {
      let pdf = doc.imagemPdfRecortada;
      if (!pdf?.startsWith("data:application/pdf")) {
        const idb = await patrimonioLerImagensDoc(id);
        pdf = idb?.imagemPdfRecortada || pdf;
      }
      pdfBtn.classList.toggle("hidden", !String(pdf || "").startsWith("data:application/pdf"));
    }
    imagemViewer.classList.remove("hidden");
    imagemViewer.setAttribute("aria-hidden", "false");
    bindZoomViewerDoc();
    patrimonioNotificarOverlayAberto();
  }

  function baixarPdfViewerImagem() {
    const id = imagemViewer?.dataset?.patId;
    const doc = id ? getDocById(id) : null;
    void (async () => {
      let pdf = doc?.imagemPdfRecortada;
      if (!pdf?.startsWith("data:application/pdf") && id) {
        const idb = await patrimonioLerImagensDoc(id);
        pdf = idb?.imagemPdfRecortada || pdf;
      }
      if (!pdf?.startsWith("data:application/pdf")) {
        setMsg("PDF não disponível para este documento.", true);
        return;
      }
      const a = document.createElement("a");
      a.href = pdf;
      a.download = `CRLV-${doc.placa || "documento"}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMsg("PDF transferido.", false, true);
    })();
  }

  function fecharViewerImagem(syncHistory = true) {
    imagemViewer?.classList.add("hidden");
    imagemViewer?.setAttribute("aria-hidden", "true");
    if (imagemViewerImg) imagemViewerImg.removeAttribute("src");
    if (unbindZoomViewerDoc) {
      unbindZoomViewerDoc();
      unbindZoomViewerDoc = null;
    }
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
        statusIaEl.innerHTML = "✓ <strong>IA no servidor</strong> — leitura automática a partir dos PDFs anexados.";
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

    btnRelatorio?.addEventListener("click", () => abrirRelatorioModal());
    bindPatrimonioPdfUpload();

    document.getElementById("patrimonioBtnReprocessarReprovados")?.addEventListener("click", () => {
      void reprocessarTodosReprovadosPatrimonio();
    });

    document.getElementById("patrimonioImagemFecharBtn")?.addEventListener("click", fecharViewerImagem);
    document.getElementById("patrimonioImagemPdfBtn")?.addEventListener("click", baixarPdfViewerImagem);
    document.getElementById("patrimonioImagemPrintBtn")?.addEventListener("click", imprimirViewerImagem);
    document.getElementById("patrimonioImagemShareEmailBtn")?.addEventListener("click", () =>
      partilharViewerImagem("email")
    );
    document.getElementById("patrimonioImagemShareWaBtn")?.addEventListener("click", () =>
      partilharViewerImagem("whatsapp")
    );

    document.getElementById("patrimonioFotoCapturaFecharBtn")?.addEventListener("click", () =>
      fecharViewerFotoCaptura()
    );
    document.getElementById("patrimonioFotoCapturaExcluirBtn")?.addEventListener("click", () => {
      const id = fotoCapturaViewer?.dataset?.fotoId || "";
      if (id) excluirFotoCaptura(id);
    });
    document.getElementById("patrimonioFotoCapturaRevisarBtn")?.addEventListener("click", () => {
      const id = fotoCapturaViewer?.dataset?.fotoId || "";
      if (id) void revisarFotoCapturaComIa(id);
    });

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
    fecharViewerFotoCaptura(false);
    fecharRelatorioModal();
    setMsg("");
    renderLista();
  }

  let migracaoScanEmCurso = false;

  async function migrarImagensPatrimonioScan() {
    if (migracaoScanEmCurso) return;
    if (patrimonioOverlayAberto() || processando || iaPatrimonioRodando) return;
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
          d.imagemRecortada = await prepararImagemDocumentoArmazenar(nova);
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
    bindPatrimonioPdfUpload();
    repararFotosCapturasPendentes();
    void (async () => {
      const removidos = await patrimonioAplicarLimpezaArquivosEnviados();
      if (removidos > 0) {
        setMsg(
          `Lista limpa: ${removidos} registo(s) duplicado(s) ou já processado(s) removido(s).`,
          false,
          true
        );
      }
      renderFotosLista();
      await reiniciarFilaPatrimonioAposAbrir();
    })();
    const store = loadStore();
    saveStore(store);
    void refreshOpenAIStatus();
    renderLista();
    try {
      sessionStorage.removeItem(PENDING_FOTO_KEY);
    } catch {
      /* ignore */
    }
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
    if (fotoCapturaViewer && !fotoCapturaViewer.classList.contains("hidden")) {
      fecharViewerFotoCaptura();
      return true;
    }
    if (relatorioModal && !relatorioModal.classList.contains("hidden")) {
      fecharRelatorioModal();
      return true;
    }
    return false;
  }

  window.__DK_patrimonioOnShow = onShowPatrimonio;
  window.__DK_patrimonioProcessarArquivosPdf = processarArquivosPdf;
  window.__DK_patrimonioEhArquivoPdf = ehArquivoPdf;
  window.__DK_patrimonioSalvarImagensDoc = patrimonioSalvarImagensDoc;
  window.__DK_patrimonioLimparArquivosEnviados = patrimonioLimparArquivosEnviados;
  window.__DK_patrimonioAplicarLimpezaArquivosEnviados = patrimonioAplicarLimpezaArquivosEnviados;
  window.__DK_patrimonioReset = resetPatrimonioUi;
  window.__DK_patrimonioEscapeBack = escapeBackPatrimonio;
  window.__DK_patrimonioOverlayAberto = patrimonioOverlayAberto;
  window.__DK_openPatrimonioImagemById = abrirViewerImagem;

  window.addEventListener("dk-comprovantes-synced", () => {
    renderLista();
  });

  bindUi();
  void (async () => {
    await patrimonioMigrarImagensDocParaIdb();
    await patrimonioAplicarLimpezaArquivosEnviados();
    renderLista();
    renderFotosLista();
  })();
})();
