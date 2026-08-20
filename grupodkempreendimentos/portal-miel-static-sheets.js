/**
 * Inicializa abas MIEL estáticas (só layout Excel exportado).
 */
(function mielStaticSheets() {
  const list = window.__DK_MIEL_STATIC_REGISTRY || [];
  if (!list.length) return;

  list.forEach((cfg) => {
    const hook = `__DK_mielInit${cfg.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())}`;
    window[hook] = function initStaticSheet() {
      let container = document.querySelector(`[data-miel-panel="${cfg.id}"]`);
      const content = document.getElementById("mielMainContent");
      if (!container && content) {
        container = document.createElement("div");
        container.className = "miel-panel hidden";
        container.setAttribute("data-miel-panel", cfg.id);
        container.id = `mielPanel${cfg.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())}`;
        content.appendChild(container);
      }
      if (!container) return;
      const lay = window[cfg.layoutKey];
      const eng = window.__DK_mielSheetEngine;
      if (!lay || !eng) {
        container.innerHTML = `<p class="miel-cc__err">Layout ${cfg.label} não carregou.</p>`;
        return;
      }
      container.innerHTML = `<div class="miel-cc__layout miel-cc__layout--sheet">
        <div class="miel-cc__main">${eng.renderSheet(lay, {
          patchHeaderCell(cell) {
            return null;
          },
        })}</div>
      </div>`;
    };
    cfg.initHook = hook;
  });

  window.__DK_MIEL_STATIC_INIT_HOOKS = Object.fromEntries(list.map((c) => [c.id, c.initHook]));
})();
