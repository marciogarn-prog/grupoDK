/** Dois botões na home: app cliente (/instalar) e app operação (portal + PWA). */
(function homeInstallPwa() {
  const btnCliente = document.getElementById("homeBaixarAppCliente");
  const btnOperacao = document.getElementById("homeBaixarAppOperacao");
  if (!btnCliente && !btnOperacao) return;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
  });

  async function ensureLatest() {
    if (typeof window.__DK_ensureLatestPwa === "function") {
      await window.__DK_ensureLatestPwa({ force: true }).catch(() => {});
    }
  }

  function clienteInstallUrl() {
    return `/instalar?_=${Date.now()}`;
  }

  function operacaoInstallUrl() {
    const base = `${location.pathname || "/"}?instalar=1`;
    return `${base}#locadora`;
  }

  btnCliente?.addEventListener("click", (e) => {
    e.preventDefault();
    void (async () => {
      await ensureLatest();
      window.location.href = clienteInstallUrl();
    })();
  });

  btnOperacao?.addEventListener("click", async (e) => {
    e.preventDefault();
    await ensureLatest();
    if (deferred && !standalone) {
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    window.location.href = operacaoInstallUrl();
  });
})();
