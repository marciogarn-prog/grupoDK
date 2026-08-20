/**
 * Fábrica de painéis MIEL — layout Excel + dados dinâmicos.
 */
(function mielSheetFactory() {
  function bindSide(container, backId) {
    container.querySelector(`[data-miel-back="${backId}"]`)?.addEventListener("click", () => {
      if (typeof window.__DK_mielShowSheet === "function") window.__DK_mielShowSheet("administrativo");
    });
    container.querySelectorAll("[data-miel-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof window.__DK_mielOpenDestino === "function") {
          window.__DK_mielOpenDestino(
            btn.getAttribute("data-miel-side") || "",
            btn.getAttribute("data-miel-side-label") || "",
            btn.getAttribute("data-miel-side-piece") || "?"
          );
        }
      });
    });
  }

  function registerSheet(cfg) {
    function init() {
      const container = document.getElementById(cfg.panelId);
      if (!container) return;
      const lay = window[cfg.layoutKey];
      const eng = window.__DK_mielSheetEngine;
      if (!lay || !eng) {
        container.innerHTML = `<p class="miel-cc__err">Layout ${cfg.sheetName} não carregou.</p>`;
        return;
      }
      const data = typeof cfg.buildRows === "function" ? cfg.buildRows() : [];
      const side =
        cfg.sideButtons
          ?.map(
            (b) =>
              `<button type="button" class="miel-admin-side-btn" data-miel-side="${b.id}" data-miel-side-label="${b.label}" data-miel-side-piece="${b.piece}">${b.text}</button>`
          )
          .join("") || "";
      container.innerHTML = `<div class="miel-cc__layout miel-cc__layout--sheet">
        <div class="miel-cc__main">${eng.renderSheet(lay, {
          patchHeaderCell: cfg.patchHeaderCell || null,
          dataRows: () => data.map((r) => cfg.rowToCells(r)),
          cellStyleFn: cfg.cellStyleFn || null,
        })}</div>
        <aside class="miel-cc__side">
          <button type="button" class="miel-nav-btn miel-stub-back" data-miel-back="${cfg.id}">← Voltar ao Administrativo</button>
          ${side}
        </aside>
      </div>`;
      bindSide(container, cfg.id);
      container.dataset[`miel${cfg.id}Ready`] = "1";
    }
    window[cfg.initHook] = init;
  }

  window.__DK_mielRegisterSheet = registerSheet;
})();
