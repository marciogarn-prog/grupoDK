/** Botão instalar PWA na home (beforeinstallprompt). */
(function homeInstallPwa() {
  const panel = document.getElementById("homeInstallPanel");
  const btn = document.getElementById("homeInstallBtn");
  const status = document.getElementById("homeInstallStatus");
  if (!panel || !btn) return;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (standalone) return;

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
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      return;
    }
    window.location.href = "app.html?instalar=1";
  });
})();
