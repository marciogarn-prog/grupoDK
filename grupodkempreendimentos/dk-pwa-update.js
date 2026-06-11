/**
 * PWA Grupo DK — registo do SW, verificação de atualização e aplicação automática.
 * Ao abrir/instalar no telemóvel, força a última versão do service worker e recarrega se necessário.
 */
(function dkPwaUpdate() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  const SW_BUILD = "20260611manut-checklist";
  const SW_URL = `/service-worker-corporativo.js?v=${SW_BUILD}`;
  const CACHE_PREFIX = "dk-corporativo-v";
  const ACTIVE_CACHE = `${CACHE_PREFIX}20260611manut-checklist`;

  const path = (location.pathname || "/").replace(/\/$/, "") || "/";
  const isClienteApp =
    path === "/cliente" ||
    path === "/instalar" ||
    path.startsWith("/cliente/") ||
    path.startsWith("/instalar/");
  if (isClienteApp) return;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const forceApply =
    /[?&]instalar=1/.test(location.search) ||
    isStandalone ||
    document.documentElement.dataset.dkPwaForce === "1";

  let reloadPending = false;
  let registrationRef = null;

  function waitForWorkerState(worker, state) {
    return new Promise((resolve) => {
      if (!worker) {
        resolve(false);
        return;
      }
      if (worker.state === state) {
        resolve(true);
        return;
      }
      worker.addEventListener("statechange", function onChange() {
        if (worker.state === state) {
          worker.removeEventListener("statechange", onChange);
          resolve(true);
        } else if (worker.state === "redundant") {
          worker.removeEventListener("statechange", onChange);
          resolve(false);
        }
      });
    });
  }

  async function purgeStaleCorporativoCaches() {
    if (!("caches" in window)) return;
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== ACTIVE_CACHE)
          .map((k) => caches.delete(k))
      );
    } catch {
      /* ignore */
    }
  }

  function activateWaitingWorker(reg) {
    if (!reg?.waiting || !navigator.serviceWorker.controller) return false;
    reloadPending = true;
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  async function ensureLatestPwa(opts) {
    const force = Boolean(opts?.force ?? forceApply);
    try {
      const reg = await navigator.serviceWorker.register(SW_URL, {
        scope: "/",
        updateViaCache: "none",
      });
      registrationRef = reg;

      await reg.update();

      if (force) await purgeStaleCorporativoCaches();

      if (activateWaitingWorker(reg)) return reg;

      if (reg.installing) {
        await waitForWorkerState(reg.installing, "installed");
        if (activateWaitingWorker(reg)) return reg;
      }

      if (force && reg.installing) {
        await waitForWorkerState(reg.installing, "activated");
      }

      if (force) await reg.update();
      activateWaitingWorker(reg);

      return reg;
    } catch (err) {
      console.warn("[DK PWA] atualização", err);
      return registrationRef;
    }
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadPending) return;
    reloadPending = false;
    try {
      localStorage.removeItem("dk_sessao_cliente");
      localStorage.removeItem("dk_portal_sessao_build");
    } catch {
      /* ignore */
    }
    const url = new URL(location.href);
    if (!url.searchParams.has("_")) {
      url.searchParams.set("_", String(Date.now()));
      location.replace(url.toString());
      return;
    }
    location.reload();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    registrationRef?.update().catch(() => {});
  });

  window.__DK_ensureLatestPwa = ensureLatestPwa;
  window.__DK_getPwaRegistration = () => registrationRef;
  window.__DK_pwaForceApply = forceApply;

  if (forceApply) {
    void ensureLatestPwa({ force: true });
  } else {
    window.addEventListener("load", () => {
      void ensureLatestPwa({ force: false });
    });
  }
})();
