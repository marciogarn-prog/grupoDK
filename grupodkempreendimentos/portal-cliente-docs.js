/**
 * Cadastro de cliente — Comprovante de residência e CNH (imagem ou PDF).
 * Novos cadastros a partir de 04/09/2026 exigem telefone, recados e os dois ficheiros.
 */
(function portalClienteDocs() {
  const STORAGE_KEY = "dk_cliente_docs_v1";
  const CORTE_NOVO_YMD = "2026-09-04";
  const MAX_BYTES = 6 * 1024 * 1024;
  const TIPOS = ["residencia", "cnh"];
  const pending = { residencia: null, cnh: null };

  function onlyDig(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dataBrParaYmd(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return "";
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function portalClienteDataEhAntesDoCorte(dataBr) {
    const ymd = dataBrParaYmd(dataBr);
    if (!ymd) return false;
    return ymd < CORTE_NOVO_YMD;
  }

  function portalClienteEhNovoCadastro(dataCadastroBr, known) {
    if (known) return false;
    return !portalClienteDataEhAntesDoCorte(dataCadastroBr);
  }

  function loadMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    } catch {
      return {};
    }
  }

  function saveMap(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map && typeof map === "object" && !Array.isArray(map) ? map : {}));
    } catch (err) {
      const msg = document.getElementById("operacaoClienteInlineMsg");
      if (msg) {
        msg.textContent =
          err && /quota|Quota/i.test(String(err.message || err))
            ? "Não foi possível guardar o documento: o ficheiro é grande demais para este navegador. Use uma imagem menor ou um PDF mais leve."
            : "Não foi possível guardar o documento no navegador.";
      }
    }
  }

  function getDocsCpf(cpfRaw) {
    const cpf = onlyDig(cpfRaw).slice(0, 11);
    if (cpf.length !== 11) return { residencia: null, cnh: null };
    const row = loadMap()[cpf] || {};
    return {
      residencia: row.residencia || null,
      cnh: row.cnh || null,
    };
  }

  function setDocCpf(cpfRaw, tipo, rec) {
    const cpf = onlyDig(cpfRaw).slice(0, 11);
    if (cpf.length !== 11 || !TIPOS.includes(tipo)) return;
    const map = loadMap();
    const prev = map[cpf] && typeof map[cpf] === "object" ? map[cpf] : {};
    map[cpf] = { ...prev, [tipo]: rec };
    saveMap(map);
  }

  function hasDoc(tipo) {
    if (pending[tipo]) return true;
    const cpf = onlyDig(document.getElementById("operacaoClienteCpf")?.value || "").slice(0, 11);
    if (cpf.length !== 11) return false;
    return Boolean(getDocsCpf(cpf)[tipo]?.data);
  }

  function docMeta(tipo) {
    if (pending[tipo]) {
      return { nome: pending[tipo].nome, mime: pending[tipo].mime, pending: true };
    }
    const cpf = onlyDig(document.getElementById("operacaoClienteCpf")?.value || "").slice(0, 11);
    const rec = cpf.length === 11 ? getDocsCpf(cpf)[tipo] : null;
    if (!rec?.data) return null;
    return { nome: rec.nome, mime: rec.mime, pending: false };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Falha ao ler o ficheiro."));
      fr.readAsDataURL(file);
    });
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const max = 1600;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > max || h > max) {
            const r = Math.min(max / w, max / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const data = canvas.toDataURL("image/jpeg", 0.74);
          URL.revokeObjectURL(url);
          resolve({
            nome: String(file.name || "imagem.jpg").replace(/\.[^.]+$/, ".jpg"),
            mime: "image/jpeg",
            data,
          });
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Imagem inválida."));
      };
      img.src = url;
    });
  }

  async function fileToRecord(file) {
    if (!file) return null;
    if (file.size > MAX_BYTES) {
      throw new Error("O ficheiro excede 6 MB.");
    }
    const mime = String(file.type || "").toLowerCase();
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(file.name || "");
    const isImg = mime.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name || "");
    if (!isPdf && !isImg) {
      throw new Error("Envie uma imagem ou um PDF.");
    }
    if (isImg) return compressImage(file);
    const data = await readFileAsDataUrl(file);
    return {
      nome: String(file.name || "documento.pdf"),
      mime: "application/pdf",
      data,
    };
  }

  function previewHost(tipo) {
    return document.getElementById(
      tipo === "cnh" ? "operacaoClienteDocCnhPreview" : "operacaoClienteDocResidenciaPreview"
    );
  }

  function renderPreview(tipo) {
    const host = previewHost(tipo);
    if (!host) return;
    const pendingRec = pending[tipo];
    const cpf = onlyDig(document.getElementById("operacaoClienteCpf")?.value || "").slice(0, 11);
    const saved = !pendingRec && cpf.length === 11 ? getDocsCpf(cpf)[tipo] : null;
    const rec = pendingRec || saved;
    if (!rec?.data) {
      host.innerHTML = `<p class="subtext portal-cliente-docs__vazio">Nenhum ficheiro.</p>`;
      return;
    }
    const isPdf = String(rec.mime || "").includes("pdf") || /\.pdf$/i.test(rec.nome || "");
    const thumb = isPdf
      ? `<span class="portal-cliente-docs__pdf">PDF</span>`
      : `<img src="${rec.data}" alt="${escHtml(rec.nome || tipo)}" class="portal-cliente-docs__img">`;
    host.innerHTML = `
      ${thumb}
      <p class="portal-cliente-docs__nome">${escHtml(rec.nome || "documento")}${pendingRec ? " · novo" : ""}</p>
      <button type="button" class="btn-primary btn-secondary-outline portal-cliente-docs__limpar" data-cliente-doc-limpar="${tipo}">Remover</button>
    `;
  }

  function renderAllPreviews() {
    TIPOS.forEach(renderPreview);
  }

  async function applyFile(tipo, file) {
    const msg = document.getElementById("operacaoClienteInlineMsg");
    try {
      const rec = await fileToRecord(file);
      pending[tipo] = rec;
      renderPreview(tipo);
      if (msg) msg.textContent = "";
    } catch (err) {
      if (msg) msg.textContent = err && err.message ? err.message : "Não foi possível ler o ficheiro.";
    }
  }

  function bindDrop(tipo, dropId, inputId) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    if (!drop || !input) return;
    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      if (f) void applyFile(tipo, f);
      input.value = "";
    });
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("is-over");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("is-over");
      const f = e.dataTransfer?.files && e.dataTransfer.files[0];
      if (f) void applyFile(tipo, f);
    });
    drop.addEventListener("paste", (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.kind === "file");
      const f = item ? item.getAsFile() : null;
      if (f) {
        e.preventDefault();
        void applyFile(tipo, f);
      }
    });
  }

  function persistPending(cpfRaw) {
    const cpf = onlyDig(cpfRaw).slice(0, 11);
    if (cpf.length !== 11) return;
    TIPOS.forEach((tipo) => {
      if (!pending[tipo]) return;
      setDocCpf(cpf, tipo, { ...pending[tipo], updatedAt: Date.now() });
      pending[tipo] = null;
    });
    if (typeof portalPushCloudSnapshotAfterPersist === "function") {
      try {
        portalPushCloudSnapshotAfterPersist();
      } catch {
        /* ignore */
      }
    }
    renderAllPreviews();
  }

  function clearPending() {
    pending.residencia = null;
    pending.cnh = null;
    renderAllPreviews();
  }

  function loadIntoUi(cpfRaw) {
    clearPending();
    const cpf = onlyDig(cpfRaw).slice(0, 11);
    if (cpf.length !== 11) {
      renderAllPreviews();
      return;
    }
    renderAllPreviews();
  }

  function bindOnce() {
    if (window.__dkPortalClienteDocsBound) return;
    window.__dkPortalClienteDocsBound = true;
    bindDrop("residencia", "operacaoClienteDocResidenciaDrop", "operacaoClienteDocResidenciaFile");
    bindDrop("cnh", "operacaoClienteDocCnhDrop", "operacaoClienteDocCnhFile");
    document.getElementById("formOperacaoClienteInline")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cliente-doc-limpar]");
      if (!btn) return;
      e.preventDefault();
      const tipo = btn.getAttribute("data-cliente-doc-limpar");
      if (!TIPOS.includes(tipo)) return;
      pending[tipo] = null;
      const cpf = onlyDig(document.getElementById("operacaoClienteCpf")?.value || "").slice(0, 11);
      if (cpf.length === 11) {
        const map = loadMap();
        if (map[cpf]) {
          map[cpf] = { ...map[cpf], [tipo]: null };
          saveMap(map);
        }
      }
      renderPreview(tipo);
    });
    renderAllPreviews();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce);
  } else {
    bindOnce();
  }

  window.__DK_portalClienteEhNovoCadastro = portalClienteEhNovoCadastro;
  window.__DK_portalClienteDataEhAntesDoCorte = portalClienteDataEhAntesDoCorte;
  window.__DK_portalClienteDocsHas = hasDoc;
  window.__DK_portalClienteDocsMeta = docMeta;
  window.__DK_portalClienteDocsPersist = persistPending;
  window.__DK_portalClienteDocsClear = clearPending;
  window.__DK_portalClienteDocsLoad = loadIntoUi;
  window.__DK_portalClienteDocsCorteYmd = CORTE_NOVO_YMD;
})();
