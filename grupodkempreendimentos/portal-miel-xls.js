/**
 * Sistema MIEL XLS — abre a planilha Excel na nuvem (OneDrive / SharePoint).
 */
(function portalMielXls() {
  async function resolveEditUrl() {
    try {
      const r = await fetch("/api/miel-xls-config", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const fromApi = String(j?.editUrl || "").trim();
        if (fromApi) return fromApi;
      }
    } catch {
      /* fallback local */
    }
    return String(window.__DK_MIEL_XLS?.editUrl || "").trim();
  }

  function showNotConfigured() {
    window.alert(
      "Planilha MIEL XLS — ligação à nuvem ainda não configurada.\n\n" +
        "Passos:\n" +
        "1. Faça upload do ficheiro miel-sistema.xlsm no OneDrive ou SharePoint (Microsoft 365).\n" +
        "2. Partilhe com permissão de EDIÇÃO para a equipa autorizada.\n" +
        "3. Copie o link «Abrir no Excel Online».\n" +
        "4. Configure a variável MIEL_XLS_EDIT_URL na Vercel (recomendado) " +
        "ou cole o link em miel-xls-config.js (editUrl).\n\n" +
        "Ficheiro local: data/miel/planilha/miel-sistema.xlsm"
    );
  }

  async function openMielXls() {
    const url = await resolveEditUrl();
    if (!url) {
      showNotConfigured();
      return;
    }
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.alert(
        "O navegador bloqueou a nova janela.\n\nPermita pop-ups para grupodkempreendimentos.com.br e tente novamente."
      );
    }
  }

  window.__DK_openMielXls = openMielXls;
})();
