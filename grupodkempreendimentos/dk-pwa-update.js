/**
 * PWA Grupo DK — registo do SW, verificação de atualização e aplicação.
 * Nunca desloga o utilizador: a sessão em localStorage sobrevive à atualização.
 * Se houver SW novo enquanto o operador trabalha, adia o reload até o separador
 * ficar em segundo plano ou 2 min sem interação.
 */
(function dkPwaUpdate() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  const SW_BUILD = "20260903multa-campos";
  const SW_URL = `/service-worker-corporativo.js?v=${SW_BUILD}`;
  const CACHE_PREFIX = "dk-corporativo-v";
  const ACTIVE_CACHE = `${CACHE_PREFIX}20260903multa-campos`;
  const IDLE_RELOAD_MS = 2 * 60 * 1000;

  const path = (location.pathname || "/").replace(/\/$/, "") || "/";
  const isClienteApp =
    path === "/cliente" ||
    path === "/instalar" ||
    path.startsWith("/cliente/") ||
    path.startsWith("/instalar/");
  if (isClienteApp) return;

  const isStandaloneEarly =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const forceApply =
    /[?&]instalar=1/.test(location.search) ||
    isStandalone ||
    document.documentElement.dataset.dkPwaForce === "1";

  let reloadPending = false;
  let softReloadScheduled = false;
  let registrationRef = null;
  let idleTimer = null;

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

  function swScopeForCurrentApp() {
    const key = typeof window.__DK_appScope === "function" ? window.__DK_appScope() : "grupodk";
    const paths = window.__DK_appScopePath || {
      grupodk: "/grupodk",
      locadora: "/dklocadora",
      centro: "/dkcentroautomotivo",
      construtora: "/dkconstrutora",
    };
    return paths[key] || "/grupodk";
  }

  async function unregisterRootCorporativoSw() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          const script =
            (reg.active && reg.active.scriptURL) ||
            (reg.installing && reg.installing.scriptURL) ||
            (reg.waiting && reg.waiting.scriptURL) ||
            "";
          let scopePath = "/";
          try {
            scopePath = new URL(reg.scope).pathname.replace(/\/$/, "") || "/";
          } catch {
            scopePath = "/";
          }
          if (script.indexOf("service-worker-corporativo") !== -1 && scopePath === "/") {
            await reg.unregister();
          }
        })
      );
    } catch {
      /* ignore */
    }
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

  function performVersionReload() {
    const url = new URL(location.href);
    if (!url.searchParams.has("_")) {
      url.searchParams.set("_", String(Date.now()));
      location.replace(url.toString());
      return;
    }
    location.reload();
  }

  function cancelSoftReloadListeners() {
    document.removeEventListener("visibilitychange", onVisibilityForSoftReload);
    ["pointerdown", "keydown", "input", "change"].forEach((ev) => {
      document.removeEventListener(ev, bumpSoftReloadIdle);
    });
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function bumpSoftReloadIdle() {
    if (!softReloadScheduled) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      cancelSoftReloadListeners();
      softReloadScheduled = false;
      performVersionReload();
    }, IDLE_RELOAD_MS);
  }

  function onVisibilityForSoftReload() {
    if (!softReloadScheduled) return;
    if (document.visibilityState !== "hidden") return;
    cancelSoftReloadListeners();
    softReloadScheduled = false;
    performVersionReload();
  }

  /** Recarrega sem apagar login; se o operador está a trabalhar, espera. */
  function scheduleSessionSafeReload() {
    if (softReloadScheduled) return;
    softReloadScheduled = true;
    if (document.visibilityState === "hidden") {
      softReloadScheduled = false;
      performVersionReload();
      return;
    }
    document.addEventListener("visibilitychange", onVisibilityForSoftReload);
    ["pointerdown", "keydown", "input", "change"].forEach((ev) => {
      document.addEventListener(ev, bumpSoftReloadIdle, { passive: true });
    });
    bumpSoftReloadIdle();
    try {
      console.info("[DK PWA] Nova versão pronta — atualiza ao mudar de separador ou após 2 min sem uso (sessão mantida).");
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
      await unregisterRootCorporativoSw();
      const reg = await navigator.serviceWorker.register(SW_URL, {
        scope: swScopeForCurrentApp(),
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
    /* NÃO apagar dk_sessao_cliente / dk_portal_sessao_build — isso deslogava no meio do trabalho. */
    scheduleSessionSafeReload();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    registrationRef?.update().catch(() => {});
  });

  window.__DK_ensureLatestPwa = ensureLatestPwa;
  window.__DK_getPwaRegistration = () => registrationRef;
  window.__DK_pwaForceApply = forceApply;
  window.__DK_pwaScheduleSessionSafeReload = scheduleSessionSafeReload;

  function pwaUpdateUiAllowed() {
    return isStandalone || forceApply;
  }

  function setPwaUpdateBtnState(btn, label, disabled) {
    if (!btn) return;
    btn.textContent = label;
    btn.disabled = Boolean(disabled);
  }

  function revealPwaUpdateUi(label) {
    if (!pwaUpdateUiAllowed()) return;
    const bar = document.getElementById("dk-pwa-update-bar");
    const btn = document.getElementById("dkPwaUpdateBtn") || document.getElementById("updateButton");
    bar?.classList.remove("hidden");
    btn?.classList.remove("hidden");
    if (btn && label) setPwaUpdateBtnState(btn, label, false);
    document.body.classList.add("dk-pwa-update-bar-visible");
    if (bar) {
      requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--dk-pwa-update-bar-h", `${bar.offsetHeight}px`);
      });
    }
  }

  function wirePwaUpdateSignals(reg) {
    if (!reg) return;
    if (reg.waiting && navigator.serviceWorker.controller) {
      revealPwaUpdateUi("Atualização pronta — aplicar");
      return;
    }
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) {
          revealPwaUpdateUi("Atualização pronta — aplicar");
        }
      });
    });
  }

  async function checkPwaUpdateManual() {
    const btn = document.getElementById("dkPwaUpdateBtn") || document.getElementById("updateButton");
    setPwaUpdateBtnState(btn, "Verificando…", true);
    try {
      const reg = registrationRef || (await ensureLatestPwa({ force: true }));
      await reg?.update();
      if (reg?.waiting && navigator.serviceWorker.controller) {
        setPwaUpdateBtnState(btn, "Aplicando…", true);
        reloadPending = true;
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }
      setPwaUpdateBtnState(btn, "App já atualizado", true);
      setTimeout(() => setPwaUpdateBtnState(btn, "Atualizar app", false), 2000);
    } catch {
      setPwaUpdateBtnState(btn, "Falha ao verificar", true);
      setTimeout(() => setPwaUpdateBtnState(btn, "Atualizar app", false), 2200);
    }
  }

  function wirePwaUpdateUi(reg) {
    if (!pwaUpdateUiAllowed()) return;
    const btn = document.getElementById("dkPwaUpdateBtn") || document.getElementById("updateButton");
    if (!btn || btn.dataset.dkPwaUpdateWired === "1") return;
    btn.dataset.dkPwaUpdateWired = "1";
    revealPwaUpdateUi("Atualizar app");
    wirePwaUpdateSignals(reg || registrationRef);
    btn.addEventListener("click", () => {
      void checkPwaUpdateManual();
    });
  }

  window.__DK_checkPwaUpdate = checkPwaUpdateManual;
  window.__DK_revealPwaUpdateUi = revealPwaUpdateUi;

  async function bootPwaUpdate() {
    const reg = await ensureLatestPwa({ force: forceApply });
    wirePwaUpdateUi(reg);
  }

  if (forceApply) {
    void bootPwaUpdate();
  } else {
    window.addEventListener("load", () => {
      void bootPwaUpdate();
    });
  }
})();
