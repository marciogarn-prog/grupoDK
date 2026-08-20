/**
 * Replica genérica das 84 abas: carrega layout Excel e ativa os vínculos.
 */
(function portalMielWorkbook() {
  const CACHE_V = "20260820miel-n7";
  const SPECIAL_SRC = {
    "cad-clientes": "data/miel/cad-clientes-layout.js",
    "cad-veiculos": "data/miel/cad-veiculos-layout.js",
    "relacao-clientes": "data/miel/relacao-clientes-layout.js",
    "relacao-veiculos": "data/miel/relacao-veiculos-layout.js",
    "status-veiculos": "data/miel/status-veiculos-layout.js",
  };

  function layoutKey(id) {
    return `__DK_MIEL_LAYOUT_${String(id || "")
      .replace(/-/g, "_")
      .toUpperCase()}_LAYOUT`;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-miel-layout-src="${src}"]`);
      if (existing) {
        if (existing.getAttribute("data-loaded") === "1") return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(src)));
        return;
      }
      const s = document.createElement("script");
      s.src = `${src}?v=${CACHE_V}`;
      s.async = true;
      s.setAttribute("data-miel-layout-src", src);
      s.onload = () => {
        s.setAttribute("data-loaded", "1");
        resolve();
      };
      s.onerror = () => reject(new Error(src));
      document.head.appendChild(s);
    });
  }

  async function ensureLayout(id) {
    const key = layoutKey(id);
    if (window[key]) return window[key];
    const src = SPECIAL_SRC[id] || `data/miel/layouts/${id}-layout.js`;
    await loadScript(src);
    return window[key] || null;
  }

  function ensurePanel(id) {
    const content = document.getElementById("mielMainContent");
    let panel = document.querySelector(`[data-miel-panel="${id}"]`);
    if (!panel && content) {
      panel = document.createElement("div");
      panel.className = "miel-panel hidden";
      panel.setAttribute("data-miel-panel", id);
      panel.id = `mielPanel_${id.replace(/-/g, "_")}`;
      content.appendChild(panel);
    }
    return panel;
  }

  async function initGenericSheet(id, label) {
    const panel = ensurePanel(id);
    if (!panel) return;
    const lay = await ensureLayout(id);
    const eng = window.__DK_mielSheetEngine;
    if (!lay || !eng) {
      panel.innerHTML = `<p class="miel-cc__err">Layout da aba «${label || id}» não carregou.</p>`;
      return;
    }
    panel.innerHTML = `<div class="miel-cc__layout miel-cc__layout--sheet"><div class="miel-cc__main">${eng.renderSheet(lay)}</div></div>`;
    panel.dataset.mielGenericReady = "1";
  }

  window.__DK_mielLayoutKey = layoutKey;
  window.__DK_mielEnsureLayout = ensureLayout;
  window.__DK_mielInitGenericSheet = initGenericSheet;
})();
