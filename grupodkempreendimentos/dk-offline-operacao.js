/**
 * App operacional instalado no Windows — banco local, modo offline e sync ao reconectar.
 * Pasta local: OPFS (GrupoDK-Operacao/dados) + IndexedDB espelho com integridade SHA-256.
 */
(function dkOfflineOperacao() {
  const IDB_NAME = "dk_operacao_offline_v1";
  const IDB_STORE = "snapshots";
  const OPFS_ROOT = "GrupoDK-Operacao";
  const OPFS_DATA = "dados";
  const SNAPSHOT_FILE = "snapshot-latest.json";
  const SESSION_OFFLINE = "dk_operacao_offline_mode";
  const SESSION_PENDING = "dk_operacao_offline_pending";
  const PROBE_INTERVAL_MS = 45000;

  let idbDb = null;
  let opfsRoot = null;
  let probeTimer = null;
  let uploadInFlight = false;
  let startupDone = false;
  let offlinePromptOpen = false;

  function isInstalledPwa() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.navigator.standalone === true) return true;
      if (window.matchMedia("(display-mode: window-controls-overlay)").matches) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function isWindowsPlatform() {
    const ua = String(navigator.userAgent || "");
    const plat = String(navigator.platform || "");
    return /Windows/i.test(ua) || plat === "Win32" || plat === "Win64";
  }

  function isOperacaoOfflineTarget() {
    if (document.getElementById("view-home") == null) return false;
    return isInstalledPwa() && isWindowsPlatform();
  }

  function setOfflineMode(on) {
    window.__DK_IS_OFFLINE_MODE__ = Boolean(on);
    try {
      if (on) sessionStorage.setItem(SESSION_OFFLINE, "1");
      else sessionStorage.removeItem(SESSION_OFFLINE);
    } catch {
      /* ignore */
    }
  }

  function isOfflineMode() {
    if (window.__DK_IS_OFFLINE_MODE__ === true) return true;
    try {
      return sessionStorage.getItem(SESSION_OFFLINE) === "1";
    } catch {
      return false;
    }
  }

  function markPendingPush() {
    try {
      sessionStorage.setItem(SESSION_PENDING, "1");
    } catch {
      /* ignore */
    }
  }

  function clearPendingPush() {
    try {
      sessionStorage.removeItem(SESSION_PENDING);
    } catch {
      /* ignore */
    }
  }

  function hasPendingPush() {
    try {
      return sessionStorage.getItem(SESSION_PENDING) === "1";
    } catch {
      return false;
    }
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(String(text || ""));
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function openIdb() {
    if (idbDb) return Promise.resolve(idbDb);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        idbDb = req.result;
        resolve(idbDb);
      };
      req.onerror = () => reject(req.error || new Error("IndexedDB indisponível"));
    });
  }

  async function idbPut(record) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(id) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function ensureOpfsRoot() {
    if (opfsRoot) return opfsRoot;
    if (!navigator.storage?.getDirectory) return null;
    try {
      const root = await navigator.storage.getDirectory();
      opfsRoot = await root.getDirectoryHandle(OPFS_ROOT, { create: true });
      await opfsRoot.getDirectoryHandle(OPFS_DATA, { create: true });
      return opfsRoot;
    } catch {
      return null;
    }
  }

  async function writeOpfsSnapshot(jsonText) {
    const root = await ensureOpfsRoot();
    if (!root) return false;
    try {
      const dataDir = await root.getDirectoryHandle(OPFS_DATA, { create: true });
      const fh = await dataDir.getFileHandle(SNAPSHOT_FILE, { create: true });
      const w = await fh.createWritable();
      await w.write(jsonText);
      await w.close();
      return true;
    } catch {
      return false;
    }
  }

  async function readOpfsSnapshot() {
    const root = await ensureOpfsRoot();
    if (!root) return null;
    try {
      const dataDir = await root.getDirectoryHandle(OPFS_DATA, { create: false });
      const fh = await dataDir.getFileHandle(SNAPSHOT_FILE, { create: false });
      const file = await fh.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  function collectPayload() {
    if (typeof window.__DK_collectPayloadFromLocalStorage === "function") {
      return window.__DK_collectPayloadFromLocalStorage();
    }
    return null;
  }

  function applyPayload(payload, opts) {
    if (typeof window.__DK_applyPayloadToLocalStorage === "function") {
      window.__DK_applyPayloadToLocalStorage(payload, opts || { replace: false, lightSanitize: true });
      return true;
    }
    return false;
  }

  async function mirrorLocalBank(opts) {
    const payload = collectPayload();
    if (!payload || typeof payload !== "object") return { ok: false, reason: "empty" };
    const json = JSON.stringify(payload);
    const hash = await sha256Hex(json);
    const record = {
      id: "latest",
      savedAt: new Date().toISOString(),
      hash,
      payload,
      channel: typeof window.__DK_deploySnapshotLabel === "function" ? window.__DK_deploySnapshotLabel() : "default",
    };
    await idbPut(record);
    await writeOpfsSnapshot(json);
    if (!(opts && opts.skipPending)) markPendingPush();
    return { ok: true, hash, savedAt: record.savedAt };
  }

  async function loadLocalBank() {
    const rec = await idbGet("latest");
    if (rec?.payload && rec.hash) {
      const json = JSON.stringify(rec.payload);
      const hash = await sha256Hex(json);
      if (hash !== rec.hash) {
        console.warn("[DK offline] integridade IDB comprometida — ignorado");
      } else {
        return rec.payload;
      }
    }
    const opfsText = await readOpfsSnapshot();
    if (opfsText) {
      try {
        const payload = JSON.parse(opfsText);
        if (payload && typeof payload === "object") return payload;
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  function blockUi(message, sub, showRetry) {
    const el = document.getElementById("dkOfflineBlockOverlay");
    const msg = document.getElementById("dkOfflineBlockMsg");
    const subEl = document.getElementById("dkOfflineBlockSub");
    const retry = document.getElementById("dkOfflineRetryBtn");
    if (!el) return;
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("dk-offline-blocked");
    if (msg) msg.textContent = message || "Aguarde…";
    if (subEl) subEl.textContent = sub || "";
    if (retry) retry.classList.toggle("hidden", !showRetry);
  }

  function unblockUi() {
    const el = document.getElementById("dkOfflineBlockOverlay");
    if (!el) return;
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dk-offline-blocked");
  }

  function showOfflinePromptModal() {
    if (offlinePromptOpen) return Promise.resolve(null);
    const modal = document.getElementById("dkOfflinePromptModal");
    if (!modal) return Promise.resolve(false);
    offlinePromptOpen = true;
    modal.classList.remove("hidden");
    return new Promise((resolve) => {
      const onYes = () => {
        cleanup();
        resolve(true);
      };
      const onNo = () => {
        cleanup();
        resolve(false);
      };
      const cleanup = () => {
        offlinePromptOpen = false;
        modal.classList.add("hidden");
        document.getElementById("dkOfflinePromptSim")?.removeEventListener("click", onYes);
        document.getElementById("dkOfflinePromptNao")?.removeEventListener("click", onNo);
      };
      document.getElementById("dkOfflinePromptSim")?.addEventListener("click", onYes);
      document.getElementById("dkOfflinePromptNao")?.addEventListener("click", onNo);
    });
  }

  function showOnlineUploadModal() {
    const modal = document.getElementById("dkOnlineUploadModal");
    modal?.classList.remove("hidden");
    blockUi(
      "SISTEMA ONLINE, REALIZANDO UP-LOAD DAS INFORMAÇÕES GERADAS E ARMAZENADAS OFF-LINE",
      "O sistema ficará indisponível até concluir o envio."
    );
  }

  function hideOnlineUploadModal() {
    document.getElementById("dkOnlineUploadModal")?.classList.add("hidden");
    unblockUi();
  }

  async function probeCloudReachable() {
    if (!navigator.onLine) return false;
    try {
      if (typeof window.__DK_fetchCloudSnapshotPayload === "function") {
        const data = await Promise.race([
          window.__DK_fetchCloudSnapshotPayload(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
        ]);
        return Boolean(data && data.payload);
      }
      const q =
        typeof window.__DK_deploySnapshotLabel === "function" && window.__DK_deploySnapshotLabel() === "demo"
          ? "?channel=demo"
          : "";
      const res = await fetch(`/api/dk-cloud-snapshot${q}`, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json", ...(q ? { "X-DK-Deploy-Channel": "demo" } : {}) },
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function pullCloudAndUpdateLocal() {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
      const r = await window.__DK_pullCloudSnapshotSilentMerge({ force: true });
      if (r && r.ok !== false) {
        await mirrorLocalBank({ skipPending: true });
        clearPendingPush();
        return { ok: true, source: "cloud" };
      }
    }
    if (typeof window.__DK_fetchCloudSnapshotPayload === "function") {
      const data = await window.__DK_fetchCloudSnapshotPayload();
      if (data?.payload) {
        applyPayload(data.payload, { replace: false, lightSanitize: true });
        await mirrorLocalBank({ skipPending: true });
        clearPendingPush();
        return { ok: true, source: data.source || "cloud" };
      }
    }
    return { ok: false };
  }

  async function uploadOfflineChanges() {
    if (uploadInFlight) return { ok: false, reason: "in_flight" };
    uploadInFlight = true;
    showOnlineUploadModal();
    try {
      await mirrorLocalBank({ skipPending: true });
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        const push = await window.__DK_pushCloudSnapshotNow({ force: true });
        if (!push || push.ok === false) {
          throw new Error("Falha ao enviar dados para a nuvem.");
        }
      }
      await pullCloudAndUpdateLocal();
      setOfflineMode(false);
      clearPendingPush();
      return { ok: true };
    } finally {
      uploadInFlight = false;
      hideOnlineUploadModal();
    }
  }

  async function offerOfflineWork() {
    const accept = await showOfflinePromptModal();
    if (!accept) {
      blockUi(
        "Sistema off-line",
        "Sem ligação à internet. Tente novamente ou escolha trabalhar off-line.",
        true
      );
      return false;
    }
    setOfflineMode(true);
    const local = await loadLocalBank();
    if (local) applyPayload(local, { replace: false, lightSanitize: true });
    unblockUi();
    startConnectivityProbe();
    return true;
  }

  async function onConnectivityRestored() {
    if (!isOfflineMode() && !hasPendingPush()) return;
    try {
      await uploadOfflineChanges();
      if (typeof window.__DK_portalRefreshOperacaoLocal === "function") {
        window.__DK_portalRefreshOperacaoLocal();
      }
    } catch (e) {
      console.warn("[DK offline] upload ao reconectar", e);
      blockUi("Erro no envio", String(e?.message || e));
      startConnectivityProbe();
    }
  }

  function startConnectivityProbe() {
    clearInterval(probeTimer);
    probeTimer = setInterval(async () => {
      if (uploadInFlight) return;
      const online = await probeCloudReachable();
      if (online && (isOfflineMode() || hasPendingPush())) {
        await onConnectivityRestored();
      } else if (!online && !isOfflineMode() && startupDone) {
        const accept = await showOfflinePromptModal();
        if (accept) {
          setOfflineMode(true);
          await mirrorLocalBank();
          startConnectivityProbe();
        }
      }
    }, PROBE_INTERVAL_MS);
  }

  async function startupInstalledPwa() {
    if (!isOperacaoOfflineTarget() || startupDone) return;
    window.__DK_offlineOperacaoEnabled = true;
    blockUi("Atualizando banco local", "A transferir dados da nuvem para este computador…");
    try {
      await openIdb();
      await ensureOpfsRoot();
    } catch (e) {
      console.warn("[DK offline] init local bank", e);
    }

    const online = await probeCloudReachable();
    if (online) {
      try {
        await pullCloudAndUpdateLocal();
        setOfflineMode(false);
        clearPendingPush();
        unblockUi();
        startupDone = true;
        startConnectivityProbe();
        return;
      } catch (e) {
        console.warn("[DK offline] pull arranque", e);
      }
    }

    const local = await loadLocalBank();
    if (local) {
      unblockUi();
      const ok = await offerOfflineWork();
      if (ok) {
        applyPayload(local, { replace: false, lightSanitize: true });
      }
    } else {
      blockUi("Sistema off-line", "Sem ligação e sem dados locais. Ligue à internet para iniciar.", true);
    }
    startupDone = true;
    startConnectivityProbe();
  }

  window.__DK_offlineOnLocalChange = function __DK_offlineOnLocalChange() {
    if (!window.__DK_offlineOperacaoEnabled) return;
    mirrorLocalBank().catch((e) => console.warn("[DK offline] mirror", e));
  };

  window.addEventListener("offline", () => {
    if (!window.__DK_offlineOperacaoEnabled || !startupDone) return;
    if (!isOfflineMode()) {
      showOfflinePromptModal().then((accept) => {
        if (accept) {
          setOfflineMode(true);
          mirrorLocalBank().catch(() => {});
        }
      });
    }
  });

  window.addEventListener("online", () => {
    if (!window.__DK_offlineOperacaoEnabled) return;
    if (isOfflineMode() || hasPendingPush()) {
      onConnectivityRestored().catch(() => {});
    }
  });

  document.getElementById("dkOfflineRetryBtn")?.addEventListener("click", () => {
    startupDone = false;
    startupInstalledPwa().catch((e) => console.warn("[DK offline] retry", e));
  });

  function boot() {
    if (!isOperacaoOfflineTarget()) return;
    const run = () => startupInstalledPwa().catch((e) => console.warn("[DK offline] startup", e));
    if (typeof window.__DK_fetchCloudSnapshotPayload === "function") {
      run();
    } else {
      window.addEventListener("dk-supabase-ready", run, { once: true });
      window.setTimeout(run, 4000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
