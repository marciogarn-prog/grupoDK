/**
 * Quatro apps no mesmo site:
 *   /                      → Grupo DK (central)
 *   /dklocadora            → DK Locadora
 *   /dkcentroautomotivo    → DK Centro Automotivo
 *   /dkconstrutora         → DK Construtora
 */
(function dkAppScope(w) {
  const MANIFEST = {
    grupodk: "/manifest-corporativo.webmanifest",
    locadora: "/manifest-locadora.webmanifest",
    centro: "/manifest-centro.webmanifest",
    construtora: "/manifest-construtora.webmanifest",
  };
  const TITLE = {
    grupodk: "Grupo DK",
    locadora: "DK Locadora",
    centro: "DK Centro Automotivo",
    construtora: "DK Construtora",
  };
  const PATH = {
    grupodk: "/",
    locadora: "/dklocadora",
    centro: "/dkcentroautomotivo",
    construtora: "/dkconstrutora",
  };

  function appScopeFromPath(pathname) {
    const parts = String(pathname || "/")
      .toLowerCase()
      .split("/")
      .filter(Boolean)
      .map((p) => p.replace(/\.html$/, ""));
    if (parts.includes("dklocadora")) return "locadora";
    if (parts.includes("dkcentroautomotivo")) return "centro";
    if (parts.includes("dkconstrutora")) return "construtora";
    return "grupodk";
  }

  function appScope() {
    return appScopeFromPath(w.location && w.location.pathname);
  }

  function appScopeIsCentral() {
    return appScope() === "grupodk";
  }

  function appScopeAllowsUnit(unit) {
    const scope = appScope();
    if (scope === "grupodk") return true;
    return scope === unit;
  }

  function syncAppManifest() {
    const scope = appScope();
    const href = MANIFEST[scope] || MANIFEST.grupodk;
    const link = document.querySelector('link[rel="manifest"]');
    if (link && link.getAttribute("href") !== href) link.setAttribute("href", href);
    const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute("content", TITLE[scope] || TITLE.grupodk);
    try {
      if (scope !== "grupodk") document.title = TITLE[scope];
    } catch {
      /* ignore */
    }
  }

  w.__DK_appScopeFromPath = appScopeFromPath;
  w.__DK_appScope = appScope;
  w.__DK_appScopeIsCentral = appScopeIsCentral;
  w.__DK_appScopeAllowsUnit = appScopeAllowsUnit;
  w.__DK_appScopePath = PATH;
  w.__DK_appScopeTitle = TITLE;
  w.__DK_syncAppManifest = syncAppManifest;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncAppManifest);
  } else {
    syncAppManifest();
  }
  syncAppManifest();
})(window);
