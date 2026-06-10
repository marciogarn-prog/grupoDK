/**
 * Depósito de documentos — CRLV, contratos e multas (sem IA).
 */
(function portalDocumentos() {
  "use strict";

  const STORAGE_KEY = "dk_documentos_deposito_v1";
  const MIGRATION_FLAG = "dk_documentos_purge_patrimonio_v1";
  const IDB_NAME = "dk_documentos_blobs_v1";
  const IDB_STORE = "files";
  const MAX_BYTES = 12 * 1024 * 1024;
  const MIME_OK = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "application/octet-stream",
  ]);

  let idbPromise = null;

  function $(id) {
    return document.getElementById(id);
  }

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normPlaca(raw) {
    const s = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (s.length === 7) return s;
    if (typeof window.normalizePlacaMercosul === "function") {
      const n = window.normalizePlacaMercosul(s);
      if (n) return String(n).toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
    return s.slice(0, 7);
  }

  function normProtocolo(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function chaveFromFilename(categoria, filename) {
    const base = String(filename || "")
      .replace(/\.[^.]+$/i, "")
      .trim();
    if (!base) return "";
    if (categoria === "crlv") {
      const p = normPlaca(base);
      return p.length >= 6 ? p : base.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
    if (categoria === "contrato") {
      return normProtocolo(base);
    }
    const up = base.toUpperCase().replace(/\s+/g, "");
    const m = up.match(/^([A-Z0-9]{6,7})[-_](\d{11})$/);
    if (m) return `${normPlaca(m[1])}-${m[2]}`;
    const parts = up.split(/[-_]/);
    if (parts.length >= 2) {
      const cpf = onlyDigits(parts[parts.length - 1]).slice(0, 11);
      const placa = normPlaca(parts.slice(0, -1).join(""));
      if (placa && cpf.length === 11) return `${placa}-${cpf}`;
    }
    return up.replace(/[^A-Z0-9-]/g, "");
  }

  function emptyDeposit() {
    return { crlv: [], contrato: [], multa: [] };
  }

  function loadDeposit() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (!p || typeof p !== "object") return emptyDeposit();
      return {
        crlv: Array.isArray(p.crlv) ? p.crlv : [],
        contrato: Array.isArray(p.contrato) ? p.contrato : [],
        multa: Array.isArray(p.multa) ? p.multa : [],
      };
    } catch {
      return emptyDeposit();
    }
  }

  function saveDeposit(dep) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dep));
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    } else if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => null);
    }
  }

  function openIdb() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB indisponível"));
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB falhou"));
    });
    return idbPromise;
  }

  async function idbPutBlob(id, blob, meta) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ id, blob, ...meta });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGetBlob(id) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDeleteBlob(id) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  function purgeLegacyPatrimonioLocal() {
    if (localStorage.getItem(MIGRATION_FLAG) === "done") return;
    [
      "dk_patrimonio_crlv_v1",
      "dk_patrimonio_fotos_excluidas_v1",
      "dk_patrimonio_deposito_v1",
      "dk_patrimonio_ia_ledger_v1",
    ].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyDeposit()));
    localStorage.setItem(MIGRATION_FLAG, "done");
  }

  function podeAcessarDocumentos() {
    if (typeof window.__DK_getPortalSessaoAdminRole !== "function") return false;
    const role = window.__DK_getPortalSessaoAdminRole();
    if (!role) return false;
    if (role === "owner") return true;
    const fn =
      typeof window.__DK_getPortalSessaoEquipaFuncionario === "function"
        ? window.__DK_getPortalSessaoEquipaFuncionario()
        : null;
    const acessosFn =
      typeof window.__DK_getPortalOperacaoAcessosEfetivos === "function"
        ? window.__DK_getPortalOperacaoAcessosEfetivos
        : null;
    if (!fn || !acessosFn) return false;
    const acessos = acessosFn(fn);
    return Boolean(acessos?.veiculo || acessos?.locacao);
  }

  function fmtData(iso) {
    const d = Date.parse(iso || "");
    if (!Number.isFinite(d)) return "—";
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function categoriaAtivaBusca() {
    const r = document.querySelector('input[name="documentosBuscaTipo"]:checked');
    return r?.value || "crlv";
  }

  function normalizarTermoBusca(categoria, termo) {
    const t = String(termo || "").trim();
    if (!t) return "";
    if (categoria === "crlv") return normPlaca(t);
    if (categoria === "contrato") return normProtocolo(t);
    const up = t.toUpperCase().replace(/\s+/g, "");
    const m = up.match(/^([A-Z0-9]{6,7})[-_]?(\d{0,11})/);
    if (m && m[2]) return `${normPlaca(m[1])}-${onlyDigits(m[2]).slice(0, 11)}`;
    if (m) return normPlaca(m[1]);
    return up.replace(/[^A-Z0-9-]/g, "");
  }

  function listarPorChave(categoria, termo) {
    const dep = loadDeposit();
    const arr = dep[categoria] || [];
    const chave = normalizarTermoBusca(categoria, termo);
    if (!chave) return [];
    return arr
      .filter((e) => {
        const k = String(e.chave || "").toUpperCase();
        return k === chave || k.includes(chave) || chave.includes(k);
      })
      .sort((a, b) => (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0));
  }

  function filtrarDepositoPorTexto(categoria, termo) {
    const cat = String(categoria || "").trim().toLowerCase();
    const dep = loadDeposit();
    const arr = dep[cat] || [];
    const t = String(termo || "").trim().toLowerCase();
    let rows = arr.slice();
    if (t) {
      rows = rows.filter((e) => {
        const nome = String(e.nomeArquivo || "").toLowerCase();
        const chave = String(e.chave || "").toLowerCase();
        return nome.includes(t) || chave.includes(t);
      });
    }
    return rows.sort((a, b) => (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0));
  }

  function obterEntradaDeposito(categoria, id) {
    const cat = String(categoria || "").trim().toLowerCase();
    if (!id) return null;
    return (loadDeposit()[cat] || []).find((e) => String(e.id) === String(id)) || null;
  }

  function contarDeposito(categoria) {
    const cat = String(categoria || "").trim().toLowerCase();
    return (loadDeposit()[cat] || []).length;
  }

  function renderBuscaResultados() {
    const wrap = $("documentosBuscaResultados");
    const msg = $("documentosBuscaMsg");
    if (!wrap) return;
    const cat = categoriaAtivaBusca();
    const termo = $("documentosBuscaInput")?.value || "";
    const rows = listarPorChave(cat, termo);
    if (msg) {
      msg.textContent = termo.trim()
        ? rows.length
          ? `${rows.length} ficheiro(s) encontrado(s).`
          : "Nenhum ficheiro para esta pesquisa."
        : "Digite a placa, protocolo ou placa-cpf e clique Buscar.";
    }
    if (!rows.length) {
      wrap.innerHTML = '<p class="subtext documentos-busca-vazio">Nenhum resultado.</p>';
      return;
    }
    wrap.innerHTML = rows
      .map(
        (e) =>
          `<article class="documentos-resultado" data-doc-id="${e.id}" data-doc-cat="${cat}">
            <div class="documentos-resultado__info">
              <strong class="documentos-resultado__nome">${String(e.nomeArquivo || e.chave).replace(/</g, "&lt;")}</strong>
              <span class="subtext">Entrada: ${fmtData(e.criadoEm)} · ${String(e.chave || "")}</span>
            </div>
            <div class="documentos-resultado__acoes">
              <button type="button" class="btn-primary btn-secondary-outline documentos-btn-ver" data-doc-id="${e.id}" data-doc-cat="${cat}">Abrir</button>
              <button type="button" class="btn-primary btn-secondary-outline documentos-btn-baixar" data-doc-id="${e.id}" data-doc-cat="${cat}">Baixar</button>
              <button type="button" class="btn-primary btn-secondary-outline documentos-btn-excluir" data-doc-id="${e.id}" data-doc-cat="${cat}">Excluir</button>
            </div>
          </article>`
      )
      .join("");
  }

  function atualizarResumosDepositos() {
    const dep = loadDeposit();
    $("documentosResumoCrlv") &&
      ($("documentosResumoCrlv").textContent = `${dep.crlv.length} ficheiro(s) CRLV no depósito.`);
    $("documentosResumoContrato") &&
      ($("documentosResumoContrato").textContent = `${dep.contrato.length} contrato(s) no depósito.`);
    $("documentosResumoMulta") &&
      ($("documentosResumoMulta").textContent = `${dep.multa.length} multa(s) no depósito.`);
  }

  async function adicionarFicheiros(categoria, fileList) {
    const msgEl = $(`documentosUploadMsg${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`);
    if (!podeAcessarDocumentos()) {
      if (msgEl) msgEl.textContent = "Sem permissão para gerir documentos.";
      return { ok: false };
    }
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return { ok: false, msg: "Nenhum ficheiro." };

    const dep = loadDeposit();
    const arr = dep[categoria] || [];
    let n = 0;

    for (const file of files) {
      const nome = String(file.name || "documento").trim();
      const mime = String(file.type || "").toLowerCase();
      const extOk = /\.(pdf|jpe?g|png|webp)$/i.test(nome);
      if (!MIME_OK.has(mime) && !extOk) continue;
      if (file.size > MAX_BYTES) {
        if (msgEl) msgEl.textContent = `«${nome}» excede 12 MB.`;
        return { ok: false };
      }
      const chave = chaveFromFilename(categoria, nome);
      if (!chave) {
        if (msgEl) msgEl.textContent = `Nome inválido: «${nome}».`;
        continue;
      }
      const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await idbPutBlob(id, file, { nomeArquivo: nome, mimeType: mime || "application/pdf" });
      arr.push({
        id,
        chave,
        nomeArquivo: nome,
        mimeType: mime || (nome.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
        tamanho: file.size,
        criadoEm: new Date().toISOString(),
      });
      n += 1;
    }

    dep[categoria] = arr;
    saveDeposit(dep);
    if (msgEl) msgEl.textContent = n ? `${n} ficheiro(s) guardado(s).` : "Nenhum ficheiro válido.";
    atualizarResumosDepositos();
    return { ok: n > 0, n };
  }

  async function obterBlobDoc(categoria, id) {
    const row = await idbGetBlob(id);
    if (row?.blob) return row;
    return null;
  }

  function abrirViewerComBlob(blob, nomeArquivo, mimeType) {
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const modal = $("documentosViewerModal");
    const iframe = $("documentosViewerIframe");
    const img = $("documentosViewerImg");
    const titulo = $("documentosViewerTitulo");
    const mime = String(mimeType || blob.type || "").toLowerCase();
    if (titulo) titulo.textContent = nomeArquivo || "Documento";
    if (mime.includes("pdf") && iframe) {
      iframe.src = url;
      iframe.classList.remove("hidden");
      img?.classList.add("hidden");
    } else if (img) {
      img.src = url;
      img.classList.remove("hidden");
      iframe?.classList.add("hidden");
    } else if (iframe) {
      iframe.src = url;
      iframe.classList.remove("hidden");
    }
    modal?.classList.remove("hidden");
    modal?.setAttribute("aria-hidden", "false");
    if (modal) modal.dataset.blobUrl = url;
    return true;
  }

  async function abrirDoc(categoria, id) {
    const row = await obterBlobDoc(categoria, id);
    if (!row?.blob) {
      alert("Ficheiro não encontrado neste computador. Carregue o documento de novo.");
      return;
    }
    abrirViewerComBlob(row.blob, row.nomeArquivo || id, row.mimeType || row.blob.type);
  }

  async function baixarDoc(categoria, id) {
    const dep = loadDeposit()[categoria] || [];
    const meta = dep.find((e) => e.id === id);
    const row = await obterBlobDoc(categoria, id);
    if (!row?.blob) {
      alert("Ficheiro não encontrado neste computador.");
      return;
    }
    const url = URL.createObjectURL(row.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = meta?.nomeArquivo || row.nomeArquivo || "documento";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function excluirDoc(categoria, id) {
    if (!podeAcessarDocumentos()) return;
    if (!window.confirm("Excluir este ficheiro do depósito?")) return;
    const dep = loadDeposit();
    dep[categoria] = (dep[categoria] || []).filter((e) => e.id !== id);
    saveDeposit(dep);
    await idbDeleteBlob(id).catch(() => null);
    atualizarResumosDepositos();
    renderBuscaResultados();
  }

  function fecharViewer() {
    const modal = $("documentosViewerModal");
    if (!modal) return;
    const url = modal.dataset.blobUrl;
    if (url) URL.revokeObjectURL(url);
    delete modal.dataset.blobUrl;
    $("documentosViewerIframe") && ($("documentosViewerIframe").src = "about:blank");
    $("documentosViewerImg") && ($("documentosViewerImg").removeAttribute("src"));
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function bindUpload(categoria, inputId, dropId) {
    const input = $(inputId);
    const drop = $(dropId);
    input?.addEventListener("change", () => {
      void adicionarFicheiros(categoria, input.files).then(() => {
        input.value = "";
      });
    });
    drop?.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("documentos-dropzone--over");
    });
    drop?.addEventListener("dragleave", () => drop.classList.remove("documentos-dropzone--over"));
    drop?.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("documentos-dropzone--over");
      void adicionarFicheiros(categoria, e.dataTransfer?.files);
    });
  }

  function bindUi() {
    $("documentosBuscaBtn")?.addEventListener("click", renderBuscaResultados);
    $("documentosBuscaInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        renderBuscaResultados();
      }
    });
    document.querySelectorAll('input[name="documentosBuscaTipo"]').forEach((el) => {
      el.addEventListener("change", renderBuscaResultados);
    });

    $("documentosBuscaResultados")?.addEventListener("click", (e) => {
      const del = e.target.closest?.(".documentos-btn-excluir");
      const ver = e.target.closest?.(".documentos-btn-ver");
      const baixar = e.target.closest?.(".documentos-btn-baixar");
      const cat = del?.dataset.docCat || ver?.dataset.docCat || baixar?.dataset.docCat;
      const id = del?.dataset.docId || ver?.dataset.docId || baixar?.dataset.docId;
      if (!cat || !id) return;
      if (del) void excluirDoc(cat, id);
      else if (ver) void abrirDoc(cat, id);
      else if (baixar) void baixarDoc(cat, id);
    });

    bindUpload("crlv", "documentosInputCrlv", "documentosDropCrlv");
    bindUpload("contrato", "documentosInputContrato", "documentosDropContrato");
    bindUpload("multa", "documentosInputMulta", "documentosDropMulta");

    $("documentosViewerFecharBtn")?.addEventListener("click", fecharViewer);
    $("documentosViewerModal")?.addEventListener("click", (e) => {
      if (e.target?.matches?.("[data-close-documentos-viewer]")) fecharViewer();
    });
  }

  function onShowDocumentos() {
    purgeLegacyPatrimonioLocal();
    if (!podeAcessarDocumentos()) {
      $("documentosMsg") && ($("documentosMsg").textContent = "Acesso negado — cadastro de veículo ou locação necessário.");
      return;
    }
    $("documentosMsg") && ($("documentosMsg").textContent = "");
    atualizarResumosDepositos();
    renderBuscaResultados();
  }

  function resetDocumentos() {
    fecharViewer();
  }

  purgeLegacyPatrimonioLocal();
  bindUi();

  window.__DK_documentosOnShow = onShowDocumentos;
  window.__DK_documentosReset = resetDocumentos;
  window.__DK_documentosEscapeBack = () => {
    if (!$("documentosViewerModal")?.classList.contains("hidden")) {
      fecharViewer();
      return true;
    }
    return false;
  };
  window.__DK_documentosPodeAcessar = podeAcessarDocumentos;
  window.__DK_documentosStorageKey = STORAGE_KEY;
  window.__DK_documentosLoadDeposit = loadDeposit;
  window.__DK_documentosListarPorChave = listarPorChave;
  window.__DK_documentosFiltrarDeposito = filtrarDepositoPorTexto;
  window.__DK_documentosObterEntrada = obterEntradaDeposito;
  window.__DK_documentosContarDeposito = contarDeposito;
  window.__DK_documentosObterBlobDoc = obterBlobDoc;
  window.__DK_documentosAbrirViewerBlob = abrirViewerComBlob;
  window.__DK_documentosNormPlaca = normPlaca;
  window.__DK_documentosNormProtocolo = normProtocolo;
  window.__DK_documentosMergeDeposit = function mergeLocalCloud(localDep, cloudDep) {
    const out = emptyDeposit();
    for (const cat of ["crlv", "contrato", "multa"]) {
      const byId = new Map();
      const push = (e) => {
        if (!e?.id) return;
        const prev = byId.get(e.id);
        if (!prev || (Date.parse(e.criadoEm || 0) || 0) >= (Date.parse(prev.criadoEm || 0) || 0)) {
          byId.set(e.id, e);
        }
      };
      (Array.isArray(cloudDep?.[cat]) ? cloudDep[cat] : []).forEach(push);
      (Array.isArray(localDep?.[cat]) ? localDep[cat] : []).forEach(push);
      out[cat] = Array.from(byId.values()).sort(
        (a, b) => (Date.parse(a.criadoEm || 0) || 0) - (Date.parse(b.criadoEm || 0) || 0)
      );
    }
    return out;
  };
})();
