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

  /** Contrato no depósito: nome do ficheiro = número do protocolo (ex.: 2026021301.pdf). */
  function nomeArquivoContrato(chaveOuProtocolo) {
    const p = normProtocolo(chaveOuProtocolo);
    return p ? `${p}.pdf` : "";
  }

  function protocoloContratoEntrada(e) {
    const fromChave = normProtocolo(e?.chave);
    if (fromChave) return fromChave;
    return normProtocolo(String(e?.nomeArquivo || "").replace(/\.pdf$/i, ""));
  }

  /** Um protocolo → um contrato visível; marca anteriores como excluídos. */
  function marcarContratosSubstituirPorProtocolo(arr, protocolo) {
    const alvo = normProtocolo(protocolo);
    if (!alvo || !Array.isArray(arr)) return 0;
    let n = 0;
    for (let i = 0; i < arr.length; i += 1) {
      const e = arr[i];
      if (!e || !depEntradaVisivel(e)) continue;
      if (protocoloContratoEntrada(e) !== alvo) continue;
      arr[i] = { ...e, excluido: true, excluidoEm: new Date().toISOString() };
      void idbDeleteBlob(e.id).catch(() => null);
      void cloudDeleteBlob(e.id).catch(() => null);
      n += 1;
    }
    return n;
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

  /** Entradas excluídas ficam como tombstone (excluido:true) para a exclusão sobreviver ao merge da nuvem. */
  function depEntradaVisivel(e) {
    return e?.excluido !== true;
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

  /* ------------------------------------------------------------------ */
  /* Nuvem: ficheiros do depósito guardados no Supabase (1 linha por    */
  /* ficheiro, label "docblob:<canal>:<id>") — acessíveis por qualquer  */
  /* operador em qualquer computador.                                   */
  /* ------------------------------------------------------------------ */

  function readMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? String(el.getAttribute("content") || "").trim() : "";
  }

  function cloudCfg() {
    const url = readMeta("dk-supabase-url");
    const key = readMeta("dk-supabase-anon-key");
    if (!url || !key) return null;
    return { url: url.replace(/\/$/, ""), key };
  }

  function cloudChannel() {
    return window.__DK_DEPLOY_CHANNEL__ === "demo" ? "demo" : "default";
  }

  function docBlobLabel(id) {
    return `docblob:${cloudChannel()}:${String(id)}`;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
      };
      r.onerror = () => reject(r.error || new Error("read_fail"));
      r.readAsDataURL(blob);
    });
  }

  function base64ToBlob(b64, mime) {
    const bin = atob(String(b64 || ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || "application/pdf" });
  }

  async function cloudPutBlob(id, blob, meta) {
    const cfg = cloudCfg();
    if (!cfg) return false;
    const b64 = await blobToBase64(blob);
    const res = await fetch(`${cfg.url}/rest/v1/dk_cloud_snapshots?on_conflict=label`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        label: docBlobLabel(id),
        payload: {
          docBlob: true,
          nomeArquivo: String(meta?.nomeArquivo || ""),
          mimeType: String(meta?.mimeType || blob.type || "application/pdf"),
          tamanho: blob.size,
          criadoEm: new Date().toISOString(),
          b64,
        },
      }),
    });
    return res.ok;
  }

  async function cloudGetBlob(id) {
    const cfg = cloudCfg();
    if (!cfg) return null;
    const res = await fetch(
      `${cfg.url}/rest/v1/dk_cloud_snapshots?label=eq.${encodeURIComponent(docBlobLabel(id))}&select=payload`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json().catch(() => null);
    const p = Array.isArray(rows) && rows[0]?.payload ? rows[0].payload : null;
    if (!p?.b64) return null;
    const blob = base64ToBlob(p.b64, p.mimeType);
    const out = {
      id: String(id),
      blob,
      nomeArquivo: p.nomeArquivo || String(id),
      mimeType: p.mimeType || blob.type,
    };
    /* cache local para abrir mais rápido da próxima vez */
    await idbPutBlob(out.id, blob, { nomeArquivo: out.nomeArquivo, mimeType: out.mimeType }).catch(() => null);
    return out;
  }

  async function cloudDeleteBlob(id) {
    const cfg = cloudCfg();
    if (!cfg) return false;
    const res = await fetch(
      `${cfg.url}/rest/v1/dk_cloud_snapshots?label=eq.${encodeURIComponent(docBlobLabel(id))}`,
      { method: "DELETE", headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    );
    return res.ok;
  }

  /**
   * Backfill upload: envia para a nuvem os ficheiros que só existem neste computador.
   */
  let depositoSyncBusy = false;

  function contarDepositoSyncPendentes() {
    const dep = loadDeposit();
    let upload = 0;
    let download = 0;
    for (const cat of ["crlv", "contrato", "multa"]) {
      for (const e of dep[cat] || []) {
        if (!e?.id || !depEntradaVisivel(e)) continue;
        if (e.nuvem !== true) upload += 1;
        else download += 1;
      }
    }
    return { upload, downloadCatalogo: download };
  }

  async function sincronizarDepositoComNuvem(onProgress) {
    if (!cloudCfg()) return { enviados: 0, pendentes: 0 };
    const dep = loadDeposit();
    const alvos = [];
    for (const cat of ["crlv", "contrato", "multa"]) {
      for (const e of dep[cat] || []) {
        if (e && e.id && e.nuvem !== true && depEntradaVisivel(e)) alvos.push(e);
      }
    }
    let enviados = 0;
    let pendentes = 0;
    let marcados = false;
    for (let i = 0; i < alvos.length; i += 1) {
      const e = alvos[i];
      try {
        const row = await idbGetBlob(e.id);
        if (!row?.blob) {
          pendentes += 1;
          continue;
        }
        const ok = await cloudPutBlob(e.id, row.blob, {
          nomeArquivo: e.nomeArquivo || row.nomeArquivo,
          mimeType: e.mimeType || row.mimeType,
        });
        if (ok) {
          e.nuvem = true;
          marcados = true;
          enviados += 1;
        } else {
          pendentes += 1;
        }
      } catch {
        pendentes += 1;
      }
      if (typeof onProgress === "function") onProgress(i + 1, alvos.length, enviados);
      if (marcados && (enviados % 20 === 0 || i === alvos.length - 1)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dep));
      }
    }
    if (marcados) saveDeposit(dep);
    return { enviados, pendentes };
  }

  /**
   * Download automático: traz da nuvem os PDFs em falta neste computador (IndexedDB).
   * Corre após pull da nuvem e ao abrir Documentos.
   */
  async function sincronizarDepositoDaNuvem(onProgress) {
    if (!cloudCfg()) return { baixados: 0, pendentes: 0, falhas: 0 };
    const dep = loadDeposit();
    let idsLocal = new Set();
    try {
      idsLocal = await idbListBlobIds();
    } catch {
      idsLocal = new Set();
    }
    const alvos = [];
    for (const cat of ["crlv", "contrato", "multa"]) {
      for (const e of dep[cat] || []) {
        if (!e?.id || !depEntradaVisivel(e)) continue;
        if (idsLocal.has(String(e.id))) continue;
        alvos.push(e);
      }
    }
    let baixados = 0;
    let pendentes = 0;
    let falhas = 0;
    let marcados = false;
    for (let i = 0; i < alvos.length; i += 1) {
      const e = alvos[i];
      try {
        const row = await cloudGetBlob(e.id);
        if (row?.blob) {
          baixados += 1;
          if (e.nuvem !== true) {
            e.nuvem = true;
            marcados = true;
          }
        } else {
          pendentes += 1;
        }
      } catch {
        falhas += 1;
      }
      if (typeof onProgress === "function") {
        onProgress(i + 1, alvos.length, baixados, "download");
      }
    }
    if (marcados) saveDeposit(dep);
    return { baixados, pendentes, falhas, total: alvos.length };
  }

  /** Upload + download — sincronização completa do depósito com a nuvem. */
  async function sincronizarDepositoBidireccional(onProgress) {
    if (depositoSyncBusy) return { ok: false, skipped: true, reason: "busy" };
    depositoSyncBusy = true;
    try {
      const up = await sincronizarDepositoComNuvem((feito, total, ok) => {
        if (typeof onProgress === "function") onProgress(feito, total, ok, "upload");
      });
      const down = await sincronizarDepositoDaNuvem(onProgress);
      const stats = contarDepositoSyncPendentes();
      let idsLocal = new Set();
      try {
        idsLocal = await idbListBlobIds();
      } catch {
        idsLocal = new Set();
      }
      const dep = loadDeposit();
      let semBlobLocal = 0;
      for (const cat of ["crlv", "contrato", "multa"]) {
        for (const e of dep[cat] || []) {
          if (!e?.id || !depEntradaVisivel(e)) continue;
          if (!idsLocal.has(String(e.id))) semBlobLocal += 1;
        }
      }
      return {
        ok: true,
        enviados: up.enviados,
        uploadPendentes: up.pendentes,
        baixados: down.baixados,
        downloadPendentes: down.pendentes,
        downloadFalhas: down.falhas,
        sincronizado: stats.upload === 0 && semBlobLocal === 0,
        semBlobLocal,
      };
    } finally {
      depositoSyncBusy = false;
    }
  }

  function fmtSyncDepositoResumo(r) {
    if (!r || r.skipped) return "";
    if (r.sincronizado) return "Depósito sincronizado com a nuvem.";
    const partes = [];
    if (r.uploadPendentes > 0 || (r.enviados > 0 && r.uploadPendentes === undefined)) {
      partes.push(`a enviar: ${r.uploadPendentes ?? contarDepositoSyncPendentes().upload}`);
    }
    if (r.semBlobLocal > 0) partes.push(`a baixar: ${r.semBlobLocal}`);
    return partes.length ? `Sincronização depósito — ${partes.join(" · ")}` : "";
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

  const MAQUINA_ID_KEY = "dk_maquina_id_v1";
  const MAQUINA_ROTULO_KEY = "dk_maquina_rotulo_v1";

  function getMaquinaId() {
    let id = localStorage.getItem(MAQUINA_ID_KEY);
    if (!id) {
      id = `maq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(MAQUINA_ID_KEY, id);
    }
    return id;
  }

  function readOperadorSessao() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      const s = raw ? JSON.parse(raw) : null;
      if (!s || typeof s !== "object") {
        return { cpf: "", nome: "Desconhecido", tipo: "", role: "" };
      }
      return {
        cpf: onlyDigits(s.cpf).slice(0, 11),
        nome: String(s.nome || s.displayName || "Operador").trim(),
        tipo: String(s.tipo || "").trim(),
        role: String(s.role || "").trim(),
      };
    } catch {
      return { cpf: "", nome: "Desconhecido", tipo: "", role: "" };
    }
  }

  function buildRastreabilidadeDeposito(extra = {}) {
    const op = readOperadorSessao();
    const rotulo = String(localStorage.getItem(MAQUINA_ROTULO_KEY) || "").trim().slice(0, 80);
    return {
      inseridoPor: {
        cpf: op.cpf,
        nome: op.nome,
        tipo: op.tipo,
        role: op.role,
      },
      inseridoEm: new Date().toISOString(),
      maquinaId: getMaquinaId(),
      maquinaRotulo: rotulo || undefined,
      maquinaUserAgent: String(navigator.userAgent || "").slice(0, 220),
      deployCanal: window.__DK_DEPLOY_CHANNEL__ === "demo" ? "demo" : "oficial",
      ...extra,
    };
  }

  function buildRastreabilidadeExclusao() {
    const op = readOperadorSessao();
    const rotulo = String(localStorage.getItem(MAQUINA_ROTULO_KEY) || "").trim().slice(0, 80);
    return {
      excluidoPor: {
        cpf: op.cpf,
        nome: op.nome,
        tipo: op.tipo,
        role: op.role,
      },
      excluidoEm: new Date().toISOString(),
      excluidoMaquinaId: getMaquinaId(),
      excluidoMaquinaRotulo: rotulo || undefined,
    };
  }

  function fmtRastreabilidade(e) {
    const ins = e?.inseridoPor;
    const quando = e?.inseridoEm || e?.criadoEm;
    const quem = ins?.nome ? String(ins.nome) : "—";
    const cpf = ins?.cpf ? ` · CPF ${ins.cpf}` : "";
    const maq = e?.maquinaRotulo || e?.maquinaId || "—";
    const canal = e?.deployCanal ? ` · ${e.deployCanal}` : "";
    return `${fmtData(quando)} · ${quem}${cpf} · ${maq}${canal}`;
  }

  function preservarRastreabilidadeDeposito(novo, prev) {
    if (!prev) return novo;
    if (!novo.inseridoPor && prev.inseridoPor) {
      novo.inseridoPor = prev.inseridoPor;
      novo.inseridoEm = novo.inseridoEm || prev.inseridoEm;
      novo.maquinaId = novo.maquinaId || prev.maquinaId;
      novo.maquinaRotulo = novo.maquinaRotulo || prev.maquinaRotulo;
      novo.maquinaUserAgent = novo.maquinaUserAgent || prev.maquinaUserAgent;
      novo.deployCanal = novo.deployCanal || prev.deployCanal;
    }
    if (!novo.contratoDados && prev.contratoDados) {
      novo.contratoDados = prev.contratoDados;
    }
    return novo;
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
    const arr = (dep[categoria] || []).filter(depEntradaVisivel);
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
    const arr = (dep[cat] || []).filter(depEntradaVisivel);
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
    return (loadDeposit()[cat] || []).filter(depEntradaVisivel).find((e) => String(e.id) === String(id)) || null;
  }

  /** Contrato no depósito pela chave exacta (= número do protocolo). Um protocolo → um contrato. */
  function obterContratoPorProtocolo(protocolo) {
    const chave = normProtocolo(protocolo);
    if (!chave) return null;
    const arr = (loadDeposit().contrato || []).filter(depEntradaVisivel);
    const matches = arr.filter((e) => {
      const kit = String(e.kitTipo || "contrato");
      if (kit !== "contrato") return false;
      return protocoloContratoEntrada(e) === chave || normProtocolo(e.chave) === chave;
    });
    if (!matches.length) return null;
    return matches.sort((a, b) => (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0))[0];
  }

  /** Garante PDF do contrato na nuvem (Supabase docblob) para todos os operadores. */
  async function garantirEntradaBlobNaNuvem(entrada) {
    if (!entrada?.id) return false;
    if (entrada.nuvem === true) return true;
    try {
      const row = await idbGetBlob(entrada.id);
      if (row?.blob) {
        const ok = await cloudPutBlob(entrada.id, row.blob, {
          nomeArquivo: entrada.nomeArquivo || row.nomeArquivo,
          mimeType: entrada.mimeType || row.mimeType,
        });
        return ok;
      }
      const cloud = await cloudGetBlob(entrada.id);
      return Boolean(cloud?.blob);
    } catch {
      return false;
    }
  }

  /**
   * Move contrato entre Contratos ATIVOS e INATIVOS (campo statusContrato).
   * Metadados sincronizam via dk_documentos_deposito_v1; PDF via docblob na nuvem.
   */
  async function moverContratoPorProtocolo(protocolo, statusContrato, opts = {}) {
    const st = String(statusContrato || "")
      .trim()
      .toLowerCase();
    if (st !== "ativo" && st !== "inativo") return { ok: false, msg: "status_invalido" };
    const chave = normProtocolo(protocolo);
    if (!chave) return { ok: false, msg: "protocolo_invalido" };

    const dep = loadDeposit();
    const arr = dep.contrato || [];
    let idx = -1;
    for (let i = 0; i < arr.length; i += 1) {
      const e = arr[i];
      if (e && depEntradaVisivel(e) && normProtocolo(e.chave) === chave) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return { ok: false, msg: "nao_encontrado" };

    const prev = arr[idx];
    const prevSt = String(prev.statusContrato || "")
      .trim()
      .toLowerCase();
    const naNuvem = await garantirEntradaBlobNaNuvem(prev);
    let changed = false;

    if (prevSt !== st) {
      arr[idx] = {
        ...prev,
        statusContrato: st,
        pastaAtualizadaEm: new Date().toISOString(),
        nuvem: naNuvem ? true : prev.nuvem,
      };
      changed = true;
    } else if (naNuvem && prev.nuvem !== true) {
      arr[idx] = { ...prev, nuvem: true };
      changed = true;
    }

    if (changed) {
      dep.contrato = arr;
      saveDeposit(dep);
      atualizarResumosDepositos();
      if (!opts.silent && typeof window.__DK_contratoLocacaoRefreshBotao === "function") {
        window.__DK_contratoLocacaoRefreshBotao();
      }
    }

    return {
      ok: true,
      moved: prevSt !== st,
      unchanged: prevSt === st,
      entry: arr[idx],
      naNuvem: arr[idx].nuvem === true,
    };
  }

  function contarDeposito(categoria) {
    const cat = String(categoria || "").trim().toLowerCase();
    return (loadDeposit()[cat] || []).filter(depEntradaVisivel).length;
  }

  /**
   * Protocolos das locações: quais estão ATIVOS (sem data de fim).
   * Contratos no depósito têm chave = número do protocolo.
   */
  function protocolosLocacoesAtivos() {
    let locs = [];
    try {
      locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
    } catch {
      locs = [];
    }
    if (!Array.isArray(locs)) locs = [];
    const ativos = new Set();
    const todos = new Set();
    for (const l of locs) {
      const nc = normProtocolo(l?.numeroContrato);
      if (!nc) continue;
      todos.add(nc);
      const fim = String(l?.fim || l?.dataFim || l?.data_fim || "").trim();
      let ativa = !fim;
      if (ativa && typeof window.__DK_isPortalLocacaoAtiva === "function") {
        ativa = Boolean(window.__DK_isPortalLocacaoAtiva(l));
      }
      if (ativa) ativos.add(nc);
    }
    return { ativos, todos };
  }

  function contratoEstaAtivo(entry, sets) {
    /* Pasta escolhida pelo operador no depósito tem prioridade */
    const st = String(entry?.statusContrato || "").trim().toLowerCase();
    if (st === "ativo") return true;
    if (st === "inativo") return false;
    /* legado (sem pasta): deduz pela locação */
    const s = sets || protocolosLocacoesAtivos();
    const nc = normProtocolo(entry?.chave);
    if (!nc) return false;
    /* protocolo sem locação conhecida: tratado como ativo (mesma regra da importação) */
    if (!s.todos.has(nc)) return true;
    return s.ativos.has(nc);
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
    const setsContrato = cat === "contrato" ? protocolosLocacoesAtivos() : null;
    const badgeContrato = (e) => {
      if (!setsContrato) return "";
      return contratoEstaAtivo(e, setsContrato)
        ? ' · <span class="documentos-resumo-contrato--ativos">locação ATIVA</span>'
        : ' · <span class="documentos-resumo-contrato--inativos">locação INATIVA</span>';
    };
    wrap.innerHTML = rows
      .map(
        (e) =>
          `<article class="documentos-resultado" data-doc-id="${e.id}" data-doc-cat="${cat}">
            <div class="documentos-resultado__info">
              <strong class="documentos-resultado__nome">${String(e.nomeArquivo || e.chave).replace(/</g, "&lt;")}</strong>
              <span class="subtext">Entrada: ${fmtData(e.criadoEm)} · ${String(e.chave || "")}${badgeContrato(e)}</span>
              <span class="subtext documentos-rastreio">Inserido: ${escHtml(fmtRastreabilidade(e))}</span>
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

  async function idbListBlobIds() {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve(new Set((req.result || []).map(String)));
      req.onerror = () => reject(req.error);
    });
  }

  function resumoContratoHtml(dep, ids) {
    const sets = protocolosLocacoesAtivos();
    const arr = (dep.contrato || []).filter(depEntradaVisivel);
    const ativos = arr.filter((e) => contratoEstaAtivo(e, sets));
    const inativos = arr.filter((e) => !contratoEstaAtivo(e, sets));
    const extra = ids
      ? ` — ${arr.filter((e) => e.nuvem === true).length} na nuvem (todos os operadores) · ${arr.filter((e) => ids.has(String(e.id))).length} neste computador.`
      : ".";
    return (
      `<span class="documentos-resumo-contrato documentos-resumo-contrato--ativos">Contratos ativos: <strong>${ativos.length}</strong></span>` +
      ` · <span class="documentos-resumo-contrato documentos-resumo-contrato--inativos">Contratos inativos: <strong>${inativos.length}</strong></span>${extra}`
    );
  }

  function atualizarResumosDepositos() {
    const dep = loadDeposit();
    $("documentosResumoCrlv") &&
      ($("documentosResumoCrlv").textContent = `${dep.crlv.filter(depEntradaVisivel).length} ficheiro(s) CRLV no depósito.`);
    $("documentosResumoContrato") &&
      ($("documentosResumoContrato").innerHTML = resumoContratoHtml(dep, null));
    $("documentosResumoMulta") &&
      ($("documentosResumoMulta").textContent = `${dep.multa.filter(depEntradaVisivel).length} multa(s) no depósito.`);
    void (async () => {
      let ids = null;
      try {
        ids = await idbListBlobIds();
      } catch {
        return;
      }
      const info = (cat) => {
        const arr = (dep[cat] || []).filter(depEntradaVisivel);
        const aqui = arr.filter((e) => ids.has(String(e.id))).length;
        const nuvem = arr.filter((e) => e.nuvem === true).length;
        return { total: arr.length, aqui, nuvem };
      };
      const texto = (i, nome) =>
        `${i.total} ${nome} no depósito — ${i.nuvem} na nuvem (todos os operadores) · ${i.aqui} neste computador.`;
      const c = info("crlv");
      if ($("documentosResumoCrlv")) {
        $("documentosResumoCrlv").textContent = texto(c, "ficheiro(s) CRLV");
      }
      if ($("documentosResumoContrato")) {
        $("documentosResumoContrato").innerHTML = resumoContratoHtml(dep, ids);
      }
      const m = info("multa");
      if ($("documentosResumoMulta")) {
        $("documentosResumoMulta").textContent = texto(m, "multa(s)");
      }
    })();
  }

  async function depositarBlob(categoria, blob, meta = {}, opts = {}) {
    const msgEl = $(`documentosUploadMsg${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`);
    if (!podeAcessarDocumentos()) {
      const contratoGeradoLocacao =
        categoria === "contrato" &&
        String(meta.origem || "") === "contrato-locacao" &&
        Boolean(normProtocolo(meta.chave));
      if (!contratoGeradoLocacao) {
        if (msgEl) msgEl.textContent = "Sem permissão para gerir documentos.";
        return { ok: false, msg: "sem_permissao" };
      }
    }
    const blobLocal = await normalizarBlobLocal(blob, meta.mimeType);
    if (!blobLocal) return { ok: false, msg: "Ficheiro inválido." };
    const chave = String(meta.chave || chaveFromFilename(categoria, meta.nomeArquivo) || "").trim();
    if (!chave) return { ok: false, msg: "Chave inválida." };
    const kitAnexo = Boolean(opts.kitAnexo || (meta.kitTipo && meta.kitTipo !== "contrato"));
    const nome =
      categoria === "contrato" && !kitAnexo
        ? nomeArquivoContrato(chave) || String(meta.nomeArquivo || "documento.pdf").trim()
        : String(meta.nomeArquivo || "documento.pdf").trim();
    const mimeFinal = String(meta.mimeType || blobLocal.type || "application/pdf").toLowerCase();
    if (blobLocal.size > MAX_BYTES) {
      if (msgEl) msgEl.textContent = `«${nome}» excede 12 MB.`;
      return { ok: false };
    }

    const dep = loadDeposit();
    const arr = dep[categoria] || [];
    let substituidos = 0;
    if (categoria === "contrato" && !kitAnexo) {
      substituidos = marcarContratosSubstituirPorProtocolo(arr, chave);
    } else if (opts.replaceChave || kitAnexo) {
      for (let i = 0; i < arr.length; i += 1) {
        const e = arr[i];
        if (e && depEntradaVisivel(e) && String(e.chave || "") === String(chave)) {
          arr[i] = { ...e, excluido: true, excluidoEm: new Date().toISOString() };
          void idbDeleteBlob(e.id).catch(() => null);
          void cloudDeleteBlob(e.id).catch(() => null);
          substituidos += 1;
        }
      }
    }

    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await idbPutBlob(id, blobLocal, { nomeArquivo: nome, mimeType: mimeFinal });
    let naNuvem = false;
    try {
      if (msgEl) msgEl.textContent = `A enviar «${nome}» para a nuvem…`;
      naNuvem = await cloudPutBlob(id, blobLocal, { nomeArquivo: nome, mimeType: mimeFinal });
    } catch {
      naNuvem = false;
    }
    const entry = {
      id,
      chave,
      nomeArquivo: nome,
      mimeType: mimeFinal,
      tamanho: blobLocal.size,
      criadoEm: new Date().toISOString(),
      nuvem: naNuvem,
      origem: String(meta.origem || "upload-manual"),
      ...buildRastreabilidadeDeposito(),
    };
    if (meta.kitTipo) entry.kitTipo = String(meta.kitTipo);
    if (meta.protocoloBase) entry.protocoloBase = String(meta.protocoloBase);
    if (categoria === "contrato" && (opts.statusContrato === "ativo" || opts.statusContrato === "inativo")) {
      entry.statusContrato = opts.statusContrato;
    }
    if (categoria === "contrato" && meta.contratoDados && typeof meta.contratoDados === "object") {
      entry.contratoDados = meta.contratoDados;
    }
    arr.push(entry);
    dep[categoria] = arr;
    saveDeposit(dep);
    if (msgEl && !opts.silent) {
      msgEl.textContent = naNuvem
        ? substituidos > 0
          ? `«${nome}» substituiu o contrato anterior — disponível na nuvem.`
          : `«${nome}» guardado — disponível na nuvem para todos os operadores.`
        : substituidos > 0
          ? `«${nome}» substituiu o contrato anterior (local).`
          : `«${nome}» guardado localmente.`;
    }
    atualizarResumosDepositos();
    return { ok: true, id, entry, naNuvem, substituidos };
  }

  async function adicionarFicheiros(categoria, fileList, opts = {}) {
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
      if (categoria === "contrato") {
        marcarContratosSubstituirPorProtocolo(arr, chave);
      }
      const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await idbPutBlob(id, file, { nomeArquivo: nome, mimeType: mime || "application/pdf" });
      const mimeFinal = mime || (nome.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      let naNuvem = false;
      try {
        if (msgEl) msgEl.textContent = `A enviar «${nome}» para a nuvem…`;
        naNuvem = await cloudPutBlob(id, file, { nomeArquivo: nome, mimeType: mimeFinal });
      } catch {
        naNuvem = false;
      }
      const entry = {
        id,
        chave,
        nomeArquivo: nome,
        mimeType: mimeFinal,
        tamanho: file.size,
        criadoEm: new Date().toISOString(),
        nuvem: naNuvem,
        origem: "upload-manual",
        ...buildRastreabilidadeDeposito(),
      };
      if (categoria === "contrato" && (opts.statusContrato === "ativo" || opts.statusContrato === "inativo")) {
        entry.statusContrato = opts.statusContrato;
      }
      arr.push(entry);
      n += 1;
    }

    dep[categoria] = arr;
    saveDeposit(dep);
    if (msgEl) {
      msgEl.textContent = n
        ? `${n} ficheiro(s) guardado(s) — disponíveis na nuvem para todos os operadores.`
        : "Nenhum ficheiro válido.";
    }
    atualizarResumosDepositos();
    return { ok: n > 0, n };
  }

  async function normalizarBlobLocal(recebido, mimeType = "application/pdf") {
    if (!recebido) return null;
    const mime = String(mimeType || "application/pdf").toLowerCase();
    if (recebido instanceof Blob) return recebido;
    if (recebido instanceof ArrayBuffer) return new Blob([recebido], { type: mime });
    if (ArrayBuffer.isView(recebido)) return new Blob([recebido], { type: mime });
    if (typeof recebido === "string" && recebido.length > 0) {
      return base64ToBlob(recebido, mime);
    }
    if (typeof recebido === "object") {
      if (typeof recebido.b64 === "string" && recebido.b64) {
        return base64ToBlob(recebido.b64, recebido.type || mime);
      }
      const ab = recebido.ab;
      if (ab instanceof ArrayBuffer || ArrayBuffer.isView(ab)) {
        return new Blob([ab], { type: recebido.type || mime });
      }
      if (ab && typeof ab.byteLength === "number") {
        try {
          return new Blob([new Uint8Array(ab)], { type: recebido.type || mime });
        } catch {
          /* cross-realm ArrayBuffer — usar base64 no envio */
        }
      }
      if (typeof recebido.arrayBuffer === "function" && typeof recebido.size === "number") {
        const buf = await recebido.arrayBuffer();
        return new Blob([buf], { type: recebido.type || mime });
      }
    }
    return null;
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const RELATORIO_TITULOS = {
    crlv: "Relatório de CRLV",
    "contrato-ativo": "Relatório de Contratos ATIVOS",
    "contrato-inativo": "Relatório de Contratos INATIVOS",
    multa: "Relatório de Multas",
  };

  function listarParaRelatorio(tipo) {
    const dep = loadDeposit();
    const sets = protocolosLocacoesAtivos();
    const visivel = (arr) => (arr || []).filter(depEntradaVisivel);
    const sort = (arr) =>
      arr.slice().sort((a, b) => {
        const ka = String(a.chave || a.nomeArquivo || "").localeCompare(String(b.chave || b.nomeArquivo || ""), "pt-BR");
        if (ka !== 0) return ka;
        return (Date.parse(b.criadoEm || 0) || 0) - (Date.parse(a.criadoEm || 0) || 0);
      });
    if (tipo === "crlv") return sort(visivel(dep.crlv));
    if (tipo === "multa") return sort(visivel(dep.multa));
    if (tipo === "contrato-ativo") {
      return sort(visivel(dep.contrato).filter((e) => contratoEstaAtivo(e, sets)));
    }
    if (tipo === "contrato-inativo") {
      return sort(visivel(dep.contrato).filter((e) => !contratoEstaAtivo(e, sets)));
    }
    return [];
  }

  function categoriaRelatorio(tipo) {
    if (tipo === "crlv") return "crlv";
    if (tipo === "multa") return "multa";
    if (tipo === "contrato-ativo" || tipo === "contrato-inativo") return "contrato";
    return "";
  }

  function buildRelatorioPopupHtml(tipo, titulo, rows, categoria) {
    const agora = new Date().toLocaleString("pt-BR");
    const corpo =
      rows.length === 0
        ? '<p class="vazio">Nenhum documento nesta pasta.</p>'
        : `<table class="tabela"><thead><tr><th>Ficheiro</th><th>Chave</th><th>Inserido por (máquina)</th><th>PDF</th></tr></thead><tbody>${rows
            .map(
              (e) =>
                `<tr>
                  <td>${escHtml(e.nomeArquivo || e.chave || "—")}</td>
                  <td><code>${escHtml(e.chave || "—")}</code></td>
                  <td>${escHtml(fmtRastreabilidade(e))}${e.nuvem ? " · nuvem" : ""}</td>
                  <td><button type="button" class="doc-link" data-cat="${escHtml(categoria)}" data-id="${escHtml(e.id)}">Ver PDF</button></td>
                </tr>`
            )
            .join("")}</tbody></table>`;
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escHtml(titulo)}</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#1a1a1a;color:#eee}
.cab{padding:14px 18px;background:#2a2a2a;border-bottom:1px solid #444}
.cab h1{margin:0 0 4px;font-size:1.15rem;color:#fff}
.cab p{margin:0;font-size:0.85rem;color:#aaa}
.conteudo{padding:16px 18px 24px}
.tabela{width:100%;border-collapse:collapse;font-size:0.9rem}
.tabela th,.tabela td{border:1px solid #444;padding:8px 10px;text-align:left;vertical-align:middle}
.tabela th{background:#333;color:#f5c518}
.tabela tr:nth-child(even){background:#222}
.doc-link{background:#e85d04;color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:600}
.doc-link:hover{background:#f48c06}
.vazio{color:#aaa;font-style:italic}
code{color:#facc15}
</style></head><body>
<div class="cab"><h1>${escHtml(titulo)}</h1><p>${rows.length} documento(s) · gerado em ${escHtml(agora)}</p></div>
<div class="conteudo">${corpo}</div>
<script>
document.body.addEventListener("click",function(e){
  var btn=e.target.closest(".doc-link");
  if(!btn||!window.opener||typeof window.opener.__DK_documentosAbrirDocPdfViewer!=="function")return;
  e.preventDefault();
  window.opener.__DK_documentosAbrirDocPdfViewer(btn.getAttribute("data-cat"),btn.getAttribute("data-id"));
});
<\/script>
</body></html>`;
  }

  async function abrirRelatorioDocumentos(tipo) {
    if (!podeAcessarDocumentos()) {
      $("documentosMsg") && ($("documentosMsg").textContent = "Sem permissão para relatórios.");
      return false;
    }
    const msgEl = $("documentosMsg");
    if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
      if (msgEl) msgEl.textContent = "A sincronizar depósito com a nuvem…";
      try {
        await window.__DK_pullCloudSnapshotSilentMerge({ force: true });
      } catch {
        /* ignore */
      }
    }
    if (typeof window.__DK_documentosSyncBidireccional === "function") {
      try {
        await window.__DK_documentosSyncBidireccional();
      } catch {
        /* ignore */
      }
    }
    const titulo = RELATORIO_TITULOS[tipo] || "Relatório";
    const categoria = categoriaRelatorio(tipo);
    if (!categoria) return false;
    const rows = listarParaRelatorio(tipo);
    const html = buildRelatorioPopupHtml(tipo, titulo, rows, categoria);
    const popup = window.open("", "_blank", "width=920,height=720");
    if (!popup) {
      $("documentosMsg") && ($("documentosMsg").textContent = "Permita pop-ups para abrir o relatório.");
      return false;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    $("documentosMsg") && ($("documentosMsg").textContent = `${titulo} aberto (${rows.length} documento(s)).`);
    return true;
  }

  function abrirPdfViewerPopup(blob, nomeArquivo, mimeType) {
    if (!blob) return false;
    const mime = String(mimeType || blob.type || "").toLowerCase();
    const nome = String(nomeArquivo || "documento.pdf").trim() || "documento.pdf";
    const url = URL.createObjectURL(blob);
    const nomeJs = JSON.stringify(nome);
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escHtml(nome)}</title>
<style>
@page{margin:0}
html,body{margin:0;height:100%;background:#111;font-family:Segoe UI,Arial,sans-serif}
.barra{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#2a2a2a;border-bottom:1px solid #444}
.barra button{background:#e85d04;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-weight:600;cursor:pointer}
.barra button:hover{background:#f48c06}
.barra-msg{color:#ccc;font-size:0.85rem;margin-left:8px}
.pdf-wrap{height:calc(100vh - 52px)}
.pdf-frame,.pdf-img{width:100%;height:100%;border:none;background:#fff;display:block;object-fit:contain}
@media print{.barra{display:none!important}.pdf-wrap{height:100vh}}
</style></head><body>
<div class="barra">
  <button type="button" id="btnImprimir">Imprimir</button>
  <button type="button" id="btnSalvar">Salvar</button>
  <span class="barra-msg">${escHtml(nome)}</span>
</div>
<div class="pdf-wrap">${
      mime.includes("pdf")
        ? `<iframe class="pdf-frame" id="pdfFrame" title="${escHtml(nome)}" src="${url}"></iframe>`
        : `<img class="pdf-img" id="pdfImg" alt="${escHtml(nome)}" src="${url}">`
    }</div>
<script>
(function(){
  var url=${JSON.stringify(url)};
  var nome=${nomeJs};
  document.getElementById("btnImprimir").addEventListener("click",function(){window.print();});
  document.getElementById("btnSalvar").addEventListener("click",function(){
    var a=document.createElement("a");
    a.href=url;a.download=nome;a.click();
  });
  window.addEventListener("beforeunload",function(){try{URL.revokeObjectURL(url);}catch(e){}});
})();
<\/script>
</body></html>`;
    const popup = window.open("", "_blank", "width=960,height=900");
    if (!popup) {
      alert("Permita pop-ups para visualizar o documento.");
      URL.revokeObjectURL(url);
      return false;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    return true;
  }

  async function abrirDocPdfViewer(categoria, id) {
    const dep = loadDeposit()[categoria] || [];
    const meta = dep.find((e) => String(e.id) === String(id));
    const row = await obterBlobDoc(categoria, id);
    if (!row?.blob) {
      alert("Ficheiro não encontrado neste computador nem na nuvem.");
      return false;
    }
    const blob = await normalizarBlobLocal(row.blob, row.mimeType || meta?.mimeType || "application/pdf");
    if (!blob) {
      alert("Não foi possível abrir o ficheiro.");
      return false;
    }
    let nome =
      categoria === "contrato"
        ? nomeArquivoContrato(meta?.chave || meta?.nomeArquivo) || meta?.nomeArquivo || row.nomeArquivo || id
        : meta?.nomeArquivo || row.nomeArquivo || id;
    return abrirPdfViewerPopup(blob, nome, row.mimeType || meta?.mimeType || blob.type);
  }

  async function obterBlobDoc(categoria, id) {
    const row = await idbGetBlob(id).catch(() => null);
    if (row?.blob) return row;
    /* não está neste computador — buscar na nuvem (depósito partilhado) */
    try {
      return await cloudGetBlob(id);
    } catch {
      return null;
    }
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
    const dep = loadDeposit()[categoria] || [];
    const meta = dep.find((e) => e.id === id);
    const mimeHint = String(meta?.mimeType || meta?.nomeArquivo || "").toLowerCase();
    if (mimeHint.includes(".pdf") || mimeHint.includes("pdf") || !mimeHint.match(/\.(jpe?g|png|webp)$/)) {
      return abrirDocPdfViewer(categoria, id);
    }
    const row = await obterBlobDoc(categoria, id);
    if (!row?.blob) {
      alert("Ficheiro não encontrado neste computador nem na nuvem. Carregue o documento de novo.");
      return;
    }
    abrirViewerComBlob(row.blob, row.nomeArquivo || id, row.mimeType || row.blob.type);
  }

  async function baixarDoc(categoria, id) {
    const dep = loadDeposit()[categoria] || [];
    const meta = dep.find((e) => e.id === id);
    const row = await obterBlobDoc(categoria, id);
    if (!row?.blob) {
      alert("Ficheiro não encontrado neste computador nem na nuvem.");
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
    /* tombstone: a exclusão precisa sobreviver ao merge com a cópia da nuvem */
    dep[categoria] = (dep[categoria] || []).map((e) =>
      String(e.id) === String(id) ? { ...e, excluido: true, ...buildRastreabilidadeExclusao() } : e
    );
    saveDeposit(dep);
    await idbDeleteBlob(id).catch(() => null);
    void cloudDeleteBlob(id).catch(() => null);
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

  function bindUpload(categoria, inputId, dropId, opts = {}) {
    const input = $(inputId);
    const drop = $(dropId);
    input?.addEventListener("change", () => {
      void adicionarFicheiros(categoria, input.files, opts).then(() => {
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
      void adicionarFicheiros(categoria, e.dataTransfer?.files, opts);
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
    bindUpload("contrato", "documentosInputContratoAtivo", "documentosDropContratoAtivo", { statusContrato: "ativo" });
    bindUpload("contrato", "documentosInputContratoInativo", "documentosDropContratoInativo", { statusContrato: "inativo" });
    bindUpload("multa", "documentosInputMulta", "documentosDropMulta");

    $("documentosRelatorioCrlv")?.addEventListener("click", () => void abrirRelatorioDocumentos("crlv"));
    $("documentosRelatorioContratoAtivo")?.addEventListener("click", () => void abrirRelatorioDocumentos("contrato-ativo"));
    $("documentosRelatorioContratoInativo")?.addEventListener("click", () => void abrirRelatorioDocumentos("contrato-inativo"));
    $("documentosRelatorioMulta")?.addEventListener("click", () => void abrirRelatorioDocumentos("multa"));

    const rotuloInp = $("documentosMaquinaRotulo");
    if (rotuloInp && !rotuloInp.dataset.bound) {
      rotuloInp.dataset.bound = "1";
      rotuloInp.value = String(localStorage.getItem(MAQUINA_ROTULO_KEY) || "");
      rotuloInp.addEventListener("change", () => {
        const v = String(rotuloInp.value || "").trim().slice(0, 80);
        if (v) localStorage.setItem(MAQUINA_ROTULO_KEY, v);
        else localStorage.removeItem(MAQUINA_ROTULO_KEY);
        const hint = $("documentosMaquinaIdHint");
        if (hint) hint.textContent = `ID técnico desta máquina: ${getMaquinaId()}`;
      });
    }

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
    const rotuloInp = $("documentosMaquinaRotulo");
    const hint = $("documentosMaquinaIdHint");
    if (rotuloInp && !rotuloInp.dataset.bound) {
      rotuloInp.value = String(localStorage.getItem(MAQUINA_ROTULO_KEY) || "");
    }
    if (hint) hint.textContent = `ID técnico desta máquina: ${getMaquinaId()}`;
    atualizarResumosDepositos();
    renderBuscaResultados();
    /* backfill bidireccional: enviar locais + baixar da nuvem */
    void (async () => {
      const msg = $("documentosMsg");
      const syncEl = $("documentosSyncStatus");
      try {
        if (syncEl) syncEl.textContent = "A sincronizar depósito com a nuvem…";
        const r = await sincronizarDepositoBidireccional((feito, total, ok, dir) => {
          const rotulo = dir === "download" ? "A baixar" : "A enviar";
          if (msg) msg.textContent = `${rotulo} ficheiros… ${feito}/${total}.`;
          if (syncEl) syncEl.textContent = `${rotulo}… ${feito}/${total}`;
        });
        const resumo = fmtSyncDepositoResumo(r);
        if (syncEl) syncEl.textContent = resumo || (r.sincronizado ? "Depósito sincronizado." : "");
        if (msg && (r.enviados > 0 || r.baixados > 0)) {
          msg.textContent = `${r.enviados || 0} enviado(s) · ${r.baixados || 0} baixado(s) da nuvem.`;
          atualizarResumosDepositos();
        } else if (msg && msg.textContent.startsWith("A ")) {
          msg.textContent = resumo || "";
        }
        if (r.baixados > 0 || r.enviados > 0) {
          try {
            window.dispatchEvent(new CustomEvent("dk-documentos-synced"));
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (syncEl) syncEl.textContent = "";
        if (msg && msg.textContent.startsWith("A ")) msg.textContent = "";
      }
    })();
  }

  function resetDocumentos() {
    fecharViewer();
  }

  purgeLegacyPatrimonioLocal();
  bindUi();

  window.addEventListener("dk-documentos-synced", () => {
    if ($("panel-documentos-locadora")?.classList.contains("hidden")) return;
    atualizarResumosDepositos();
    renderBuscaResultados();
  });

  /* pedir armazenamento persistente — evita o navegador apagar os PDFs do depósito */
  try {
    if (navigator.storage && typeof navigator.storage.persist === "function") {
      void navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }

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
  window.__DK_documentosObterContratoPorProtocolo = obterContratoPorProtocolo;
  window.__DK_documentosMoverContratoPorProtocolo = moverContratoPorProtocolo;
  window.__DK_documentosGarantirBlobNaNuvem = garantirEntradaBlobNaNuvem;
  window.__DK_documentosContarDeposito = contarDeposito;
  window.__DK_documentosObterBlobDoc = obterBlobDoc;
  window.__DK_documentosDepositarBlob = depositarBlob;
  window.__DK_documentosSyncNuvem = sincronizarDepositoComNuvem;
  window.__DK_documentosSyncDaNuvem = sincronizarDepositoDaNuvem;
  window.__DK_documentosSyncBidireccional = sincronizarDepositoBidireccional;
  window.__DK_documentosSyncStatusResumo = fmtSyncDepositoResumo;
  window.__DK_documentosCloudGetBlob = cloudGetBlob;
  window.__DK_documentosAbrirViewerBlob = abrirViewerComBlob;
  window.__DK_documentosAbrirDocPdfViewer = abrirDocPdfViewer;
  window.__DK_documentosAbrirRelatorio = abrirRelatorioDocumentos;
  window.__DK_documentosNormalizarBlob = normalizarBlobLocal;
  window.__DK_documentosNormPlaca = normPlaca;
  window.__DK_documentosNormProtocolo = normProtocolo;
  window.__DK_documentosNomeArquivoContrato = nomeArquivoContrato;
  window.__DK_documentosFmtRastreabilidade = fmtRastreabilidade;
  window.__DK_documentosBuildRastreabilidadeDeposito = buildRastreabilidadeDeposito;
  window.__DK_documentosMergeDeposit = function mergeLocalCloud(localDep, cloudDep) {
    const out = emptyDeposit();
    for (const cat of ["crlv", "contrato", "multa"]) {
      const byId = new Map();
      const push = (e) => {
        if (!e?.id) return;
        const prev = byId.get(e.id);
        if (!prev) {
          byId.set(e.id, e);
          return;
        }
        let novo = (Date.parse(e.criadoEm || 0) || 0) >= (Date.parse(prev.criadoEm || 0) || 0) ? { ...e } : { ...prev };
        novo = preservarRastreabilidadeDeposito(novo, prev);
        novo = preservarRastreabilidadeDeposito(novo, e);
        /* nuvem:true nunca regride — se um lado já enviou o ficheiro, mantém */
        if (prev.nuvem === true || e.nuvem === true) novo.nuvem = true;
        /* pasta ativo/inativo escolhida pelo operador nunca se perde no merge */
        if (!novo.statusContrato && (prev.statusContrato || e.statusContrato)) {
          novo.statusContrato = prev.statusContrato || e.statusContrato;
        }
        /* tombstone: ficheiro excluído num lado fica excluído nos dois */
        if (prev.excluido === true || e.excluido === true) {
          novo.excluido = true;
          novo.excluidoEm = novo.excluidoEm || prev.excluidoEm || e.excluidoEm || new Date().toISOString();
        }
        byId.set(e.id, novo);
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
