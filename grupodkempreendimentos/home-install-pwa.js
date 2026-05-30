/** Botão instalar PWA na home (beforeinstallprompt) + força última versão ao abrir. */
(function homeInstallPwa() {
  const panel = document.getElementById("homeInstallPanel");
  const btn = document.getElementById("homeInstallBtn");
  const link = document.getElementById("homeBaixarAppLink");
  const status = document.getElementById("homeInstallStatus");
  if (!panel || !btn) return;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (standalone) return;

  function appInstallUrl() {
    return `app.html?instalar=1&_=${Date.now()}`;
  }

  async function irParaInstalacaoApp() {
    if (status) status.textContent = "A preparar a última versão do app…";
    if (typeof window.__DK_ensureLatestPwa === "function") {
      await window.__DK_ensureLatestPwa({ force: true }).catch(() => {});
    }
    window.location.href = appInstallUrl();
  }

  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    panel.classList.remove("hidden");
    if (status) status.textContent = "Toque em «Instalar app agora» ou use «Baixar APP».";
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    panel.classList.add("hidden");
  });

  btn.addEventListener("click", async () => {
    if (deferred) {
      if (typeof window.__DK_ensureLatestPwa === "function") {
        await window.__DK_ensureLatestPwa({ force: true }).catch(() => {});
      }
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    await irParaInstalacaoApp();
  });

  link?.addEventListener("click", (e) => {
    e.preventDefault();
    void irParaInstalacaoApp();
  });
})();
